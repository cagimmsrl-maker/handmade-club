// API che il servizio TGS (accanto alla cassa) chiama ogni ~10 s.
// Specifica: "API clienti fidelity TGS" v1 del 26/10/2026 (modello pull).
// Lunghezze TGS: id 64, nome/cognome 100, telefono 15, e-mail 100, QR 50.

const pool = require('../db/pool');

const LIMITE_DEFAULT = 50;
const LIMITE_MAX = 500;
const FUSO = 'Europe/Rome';

function taglia(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

// ISO 8601 con fuso esplicito nell'ora dei locali (2026-10-26T18:30:00+01:00),
// come chiede la specifica; "Z" sarebbe corretto ma meno leggibile per loro.
function isoConFuso(d) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: FUSO, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'longOffset',
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  const offset = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.replace('GMT', '');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
}

// Solo cifre ed eventuale + iniziale, max 15 (regola TGS), sempre in formato
// internazionale: TGS riconosce un cliente già presente dal telefono, quindi
// "3351234567" e "+393351234567" devono arrivare uguali. Non si toccano i
// dati salvati in app: la normalizzazione è solo verso la cassa.
function telefonoTgs(t) {
  let s = String(t || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (!s.startsWith('+')) {
    if (s.startsWith('00')) s = '+' + s.slice(2);                       // 0039335… → +39335…
    else if (/^39\d{9,10}$/.test(s)) s = '+' + s;                       // 39335… → +39335…
    else if (/^3\d{8,9}$/.test(s)) s = '+39' + s;                       // 335… (cellulare italiano) → +39335…
    else if (/^0\d{5,10}$/.test(s)) s = '+39' + s;                      // fisso italiano
  }
  return s.slice(0, 15);
}

// GET /api/tgs/clienti-da-sincronizzare?limite=50
// Clienti attivi con tessera attiva che per QUESTA sede non hanno ancora un
// esito. Gli 'errore' restano fuori (altrimenti girerebbero all'infinito):
// si riprovano dall'admin togliendo la riga.
async function clientiDaSincronizzare(req, res, next) {
  try {
    const limite = Math.min(LIMITE_MAX, Math.max(1, parseInt(req.query.limite, 10) || LIMITE_DEFAULT));
    const { rows } = await pool.query(
      `SELECT c.id, c.nome, c.cognome, c.telefono, c.email, c.created_at, t.codice_qr
         FROM clienti c
         JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
        WHERE c.stato = 'attivo'
          AND NOT EXISTS (
                SELECT 1 FROM tgs_sincronizzazioni s
                 WHERE s.cliente_id = c.id AND s.sede_id = $1 AND s.stato IN ('creato', 'gia_presente', 'errore'))
        ORDER BY c.id
        LIMIT $2`,
      [req.tgs.sedeId, limite]
    );
    res.set('Cache-Control', 'no-store');
    res.json({
      clienti: rows.map((r) => ({
        id: String(r.id),                               // stringa, stabile, ≤ 64
        nome: taglia(r.nome, 100),
        cognome: taglia(r.cognome, 100) || '',          // obbligatorio (dal 27/10 anche in app); vuoto solo per iscritti prima
        telefono: telefonoTgs(r.telefono),
        email: r.email && String(r.email).trim().length <= 100 ? String(r.email).trim() : null,
        qrCode: taglia(r.codice_qr, 50),
        registratoIl: isoConFuso(r.created_at),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/tgs/clienti/:id/esito
// { esito, codiceClienteTgs, codiceCardTgs, barcodeCard, messaggio, elaboratoIl }
// → 204. Idempotente: un esito ripetuto aggiorna la stessa riga (cliente, sede).
async function esito(req, res, next) {
  try {
    const clienteId = parseInt(String(req.params.id).replace(/^hc-/, ''), 10);
    if (!Number.isInteger(clienteId)) return res.status(404).json({ errore: 'Cliente non trovato.' });
    const { rows: esiste } = await pool.query(`SELECT 1 FROM clienti WHERE id = $1`, [clienteId]);
    if (esiste.length === 0) return res.status(404).json({ errore: 'Cliente non trovato.' });

    const e = req.body;
    await pool.query(
      `INSERT INTO tgs_sincronizzazioni
         (cliente_id, sede_id, stato, tgs_codice_cliente, tgs_codice_card, tgs_numero_pay, messaggio, elaborato_il)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (cliente_id, sede_id) DO UPDATE SET
         stato = EXCLUDED.stato,
         tgs_codice_cliente = COALESCE(EXCLUDED.tgs_codice_cliente, tgs_sincronizzazioni.tgs_codice_cliente),
         tgs_codice_card    = COALESCE(EXCLUDED.tgs_codice_card,    tgs_sincronizzazioni.tgs_codice_card),
         tgs_numero_pay     = COALESCE(EXCLUDED.tgs_numero_pay,     tgs_sincronizzazioni.tgs_numero_pay),
         messaggio = EXCLUDED.messaggio,
         elaborato_il = COALESCE(EXCLUDED.elaborato_il, tgs_sincronizzazioni.elaborato_il),
         esiti_ricevuti = tgs_sincronizzazioni.esiti_ricevuti + 1,
         ultimo_esito_il = now()`,
      [clienteId, req.tgs.sedeId, e.esito, e.codiceClienteTgs, e.codiceCardTgs, e.barcodeCard, e.messaggio, e.elaboratoIl]
    );
    if (e.esito === 'errore') console.error(`[tgs] esito errore per cliente ${clienteId} (sede ${req.tgs.sedeNome}): ${e.messaggio || 'senza dettaglio'}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/tgs/sincronizzazione — riepilogo per l'admin.
async function riepilogoAdmin(req, res, next) {
  try {
    const { rows: sedi } = await pool.query(
      `SELECT s.id, s.nome,
              (SELECT count(*)::int FROM clienti c JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
                WHERE c.stato = 'attivo') AS clienti_attivi,
              (SELECT count(*)::int FROM tgs_sincronizzazioni x WHERE x.sede_id = s.id AND x.stato = 'creato') AS creati,
              (SELECT count(*)::int FROM tgs_sincronizzazioni x WHERE x.sede_id = s.id AND x.stato = 'gia_presente') AS gia_presenti,
              (SELECT count(*)::int FROM tgs_sincronizzazioni x WHERE x.sede_id = s.id AND x.stato = 'errore') AS errori,
              (SELECT max(k.ultimo_uso_il) FROM tgs_chiavi_api k WHERE k.sede_id = s.id AND k.attiva) AS ultimo_contatto,
              (SELECT count(*)::int FROM tgs_chiavi_api k WHERE k.sede_id = s.id AND k.attiva) AS chiavi_attive,
              (SELECT count(*)::int FROM tgs_sinc_promozioni x WHERE x.sede_id = s.id AND x.stato = 'attivata') AS promo_attivate,
              (SELECT count(*)::int FROM tgs_sinc_promozioni x WHERE x.sede_id = s.id AND x.stato = 'errore') AS promo_errori,
              (SELECT count(*)::int FROM tgs_passaggi x WHERE x.sede_id = s.id) AS passaggi,
              (SELECT max(x.passato_il) FROM tgs_passaggi x WHERE x.sede_id = s.id) AS ultimo_passaggio
         FROM sedi s WHERE s.attiva = true ORDER BY s.nome`
    );
    const { rows: errori } = await pool.query(
      `SELECT x.cliente_id, c.nome, c.cognome, s.nome AS sede, s.id AS sede_id, x.messaggio, x.ultimo_esito_il
         FROM tgs_sincronizzazioni x JOIN clienti c ON c.id = x.cliente_id JOIN sedi s ON s.id = x.sede_id
        WHERE x.stato = 'errore' ORDER BY x.ultimo_esito_il DESC LIMIT 20`
    );
    res.json({
      sedi: sedi.map((s) => ({
        ...s,
        daSincronizzare: Math.max(0, s.clienti_attivi - s.creati - s.gia_presenti - s.errori),
      })),
      ultimiErrori: errori,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/tgs/sincronizzazione/:clienteId/riprova?sede=ID — rimette in coda un errore.
async function riprovaAdmin(req, res, next) {
  try {
    const clienteId = parseInt(req.params.clienteId, 10);
    const sedeId = parseInt(req.query.sede, 10);
    const { rowCount } = await pool.query(
      `DELETE FROM tgs_sincronizzazioni WHERE cliente_id = $1 AND sede_id = $2 AND stato = 'errore'`,
      [clienteId, sedeId]
    );
    res.json({ ok: true, rimesso: rowCount > 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = { clientiDaSincronizzare, esito, riepilogoAdmin, riprovaAdmin, isoConFuso, telefonoTgs };
