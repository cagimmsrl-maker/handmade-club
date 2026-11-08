// Notifiche push (Web Push / VAPID) — migrazione 014.
//
// Nessun servizio esterno: il browser del cliente ci dà un "endpoint" (su
// server Google/Apple/Mozilla) e noi gli mandiamo messaggi firmati con le
// nostre chiavi VAPID. Chiavi nel .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (mailto:). Si generano una volta con `npm run genera-chiavi-push`.
// Senza chiavi il modulo è spento: il client non mostra il pulsante.
//
// Regola: le notifiche sono promozionali → si inviano SOLO ai clienti con
// consenso marketing attivo (prestato e non revocato), e solo a clienti
// attivi. Il filtro si applica all'invio, così chi revoca il consenso smette
// di riceverle subito anche se il telefono resta iscritto.

const webpush = require('web-push');
const pool = require('../db/pool');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:privacy@handmadecafe.it';

const attivo = !!(PUBLIC_KEY && PRIVATE_KEY);
if (attivo) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY mancanti: notifiche push spente');
}

function chiavePubblica() {
  return attivo ? PUBLIC_KEY : null;
}

// Salva (o rinnova) l'iscrizione di un telefono. L'endpoint è unico: se lo
// stesso telefono si iscrive di nuovo (o cambia cliente) si aggiorna la riga.
async function iscrivi(clienteId, sub, userAgent) {
  await pool.query(
    `INSERT INTO push_iscrizioni (cliente_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET cliente_id = EXCLUDED.cliente_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent, fallimenti = 0`,
    [clienteId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, (userAgent || '').slice(0, 300)],
  );
}

async function disiscrivi(clienteId, endpoint) {
  const { rowCount } = await pool.query(
    'DELETE FROM push_iscrizioni WHERE cliente_id = $1 AND endpoint = $2',
    [clienteId, endpoint],
  );
  return rowCount > 0;
}

async function iscrizioniDi(clienteId) {
  const { rows } = await pool.query(
    'SELECT endpoint, created_at FROM push_iscrizioni WHERE cliente_id = $1 ORDER BY created_at',
    [clienteId],
  );
  return rows;
}

// Clienti raggiungibili: attivi, con consenso marketing, con almeno un
// telefono iscritto, e che rispettano il filtro (livello; sede = dove sono
// già stati registrati in cassa o scansionati).
function condizioniDestinatari(filtro, params) {
  const cond = [
    `c.stato = 'attivo'`,
    `c.consenso_marketing_il IS NOT NULL`,
    `c.consenso_marketing_revocato_il IS NULL`,
  ];
  if (filtro.livelloId) {
    params.push(filtro.livelloId);
    cond.push(`c.livello_id = $${params.length}`);
  }
  if (filtro.sedeId) {
    params.push(filtro.sedeId);
    cond.push(`(EXISTS (SELECT 1 FROM tgs_sincronizzazioni s WHERE s.cliente_id = c.id AND s.sede_id = $${params.length} AND s.stato IN ('creato','gia_presente'))
             OR EXISTS (SELECT 1 FROM scansioni sc WHERE sc.cliente_id = c.id AND sc.sede_id = $${params.length}))`);
  }
  return cond.join(' AND ');
}

async function contaDestinatari(filtro = {}) {
  const params = [];
  const where = condizioniDestinatari(filtro, params);
  const { rows: [r] } = await pool.query(
    `SELECT COUNT(DISTINCT c.id)::int AS clienti, COUNT(p.id)::int AS telefoni
     FROM clienti c JOIN push_iscrizioni p ON p.cliente_id = c.id
     WHERE ${where}`,
    params,
  );
  return r;
}

// Invia a tutti i destinatari del filtro. Un invio per iscrizione, in
// parallelo a gruppi di 20. 404/410 = iscrizione morta → la cancelliamo.
// Ritorna i conteggi e registra la notifica nello storico.
async function invia({ titolo, testo, url, filtro = {}, adminId = null }) {
  if (!attivo) {
    const e = new Error('Notifiche push non configurate sul server (chiavi VAPID mancanti).');
    e.status = 503;
    throw e;
  }
  const params = [];
  const where = condizioniDestinatari(filtro, params);
  const { rows: iscrizioni } = await pool.query(
    `SELECT p.id, p.endpoint, p.p256dh, p.auth, c.id AS cliente_id
     FROM clienti c JOIN push_iscrizioni p ON p.cliente_id = c.id
     WHERE ${where}`,
    params,
  );
  const destinatari = new Set(iscrizioni.map((i) => i.cliente_id)).size;

  const payload = JSON.stringify({
    titolo,
    testo,
    url: url || '/promozioni',
    // Stessa notifica su più schede/finestre dello stesso telefono → una sola.
    tag: `hc-${Date.now()}`,
  });

  let consegnate = 0, fallite = 0, rimosse = 0;
  const morte = [];
  const errori = [];
  const GRUPPO = 20;
  for (let i = 0; i < iscrizioni.length; i += GRUPPO) {
    const gruppo = iscrizioni.slice(i, i + GRUPPO);
    await Promise.all(gruppo.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        );
        consegnate++;
        await pool.query('UPDATE push_iscrizioni SET ultimo_invio_il = now(), fallimenti = 0 WHERE id = $1', [s.id]);
      } catch (err) {
        const codice = err?.statusCode;
        if (codice === 404 || codice === 410) {
          morte.push(s.id);
          rimosse++;
        } else {
          fallite++;
          errori.push(codice || err?.message);
          await pool.query('UPDATE push_iscrizioni SET fallimenti = fallimenti + 1 WHERE id = $1', [s.id]);
        }
      }
    }));
  }
  if (morte.length) await pool.query('DELETE FROM push_iscrizioni WHERE id = ANY($1::int[])', [morte]);
  // Iscrizioni che falliscono da troppo tempo (es. endpoint bloccato) non si
  // tengono per sempre.
  await pool.query('DELETE FROM push_iscrizioni WHERE fallimenti >= 8');

  if (errori.length) console.warn(`[push] ${fallite} invii falliti (codici: ${[...new Set(errori)].join(', ')})`);

  const { rows: [n] } = await pool.query(
    `INSERT INTO notifiche (titolo, testo, url, filtro, destinatari, inviate, consegnate, fallite, rimosse, creato_da)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [titolo, testo, url || null, JSON.stringify(filtro), destinatari, iscrizioni.length, consegnate, fallite, rimosse, adminId],
  );
  console.log(`[push] notifica #${n.id} "${titolo}": ${destinatari} clienti, ${iscrizioni.length} telefoni, ${consegnate} consegnate, ${fallite} fallite, ${rimosse} rimosse`);
  return serializza(n);
}

async function storico() {
  const { rows } = await pool.query(
    `SELECT n.*, a.username AS admin_username
     FROM notifiche n LEFT JOIN admin_users a ON a.id = n.creato_da
     ORDER BY n.created_at DESC LIMIT 100`,
  );
  return rows.map(serializza);
}

// Quanti telefoni iscritti e quanti clienti raggiungibili, per l'admin.
async function riepilogo() {
  const { rows: [tot] } = await pool.query(
    `SELECT COUNT(*)::int AS telefoni, COUNT(DISTINCT cliente_id)::int AS clienti FROM push_iscrizioni`,
  );
  const raggiungibili = await contaDestinatari({});
  return { attivo, telefoni: tot.telefoni, clientiIscritti: tot.clienti, raggiungibili };
}

function serializza(n) {
  return {
    id: n.id,
    titolo: n.titolo,
    testo: n.testo,
    url: n.url,
    filtro: n.filtro,
    destinatari: n.destinatari,
    inviate: n.inviate,
    consegnate: n.consegnate,
    fallite: n.fallite,
    rimosse: n.rimosse,
    adminUsername: n.admin_username,
    createdAt: n.created_at,
  };
}

module.exports = { attivo, chiavePubblica, iscrivi, disiscrivi, iscrizioniDi, contaDestinatari, invia, storico, riepilogo };
