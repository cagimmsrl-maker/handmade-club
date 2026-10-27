// Coda eventi verso la cassa (tabella tgs_eventi, migrazione 007).
// accoda() è l'unica cosa chiamata dal resto dell'app ed è "fail-open":
// non lancia mai, e con TGS spento non scrive nemmeno. Il lavoratore
// (avviaLavoratore) consegna gli eventi in sottofondo con ritentativi a
// pausa crescente, uno alla volta e in ordine, così la cassa non riceve
// mai la promo prima del cliente.

const pool = require('../../db/pool');
const config = require('./config');
const fidelity = require('./fidelity');

const MAX_TENTATIVI = 12;                 // ~ un giorno con il backoff sotto
const INTERVALLO_MS = 15 * 1000;          // quanto spesso il lavoratore guarda la coda
const LOTTO = 20;

function pausaDopo(tentativi) {
  // 30s, 1m, 2m, 4m, … fino a 2h
  return Math.min(30 * 2 ** (tentativi - 1), 2 * 60 * 60) * 1000;
}

async function accoda(tipo, clienteId, payload = {}) {
  if (!config.leggi().abilitato) return null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tgs_eventi (tipo, cliente_id, payload) VALUES ($1, $2, $3) RETURNING id`,
      [tipo, clienteId, JSON.stringify(payload)]
    );
    return rows[0].id;
  } catch (err) {
    console.error(`[tgs] impossibile accodare ${tipo} per cliente ${clienteId}: ${err.message}`);
    return null;
  }
}

// Dati freschi del cliente al momento dell'invio (non quelli di quando
// l'evento è stato accodato): se nel frattempo ha corretto il nome o è
// salito di livello, in cassa arriva lo stato attuale.
async function datiCliente(clienteId) {
  const { rows: [c] } = await pool.query(
    `SELECT c.id, c.nome, c.cognome, c.telefono, c.email, c.data_nascita, c.stato,
            t.codice AS codice_tessera, t.codice_qr,
            l.sconto_percentuale AS sconto_livello
       FROM clienti c
       LEFT JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
       LEFT JOIN livelli l ON l.id = c.livello_id
      WHERE c.id = $1`,
    [clienteId]
  );
  return c || null;
}

async function esegui(evento) {
  const c = await datiCliente(evento.cliente_id);
  if (!c || c.stato !== 'attivo' || !c.codice_qr) {
    // Cliente cancellato o senza tessera: niente da mandare, evento chiuso.
    return { saltato: 'cliente non attivo o senza tessera' };
  }
  const p = evento.payload || {};

  switch (evento.tipo) {
    case 'cliente_upsert':
      await fidelity.insertUpdateCustomer({
        codiceQr: c.codice_qr, nome: c.nome, cognome: c.cognome, telefono: c.telefono,
        email: c.email, dataNascita: c.data_nascita, scontoPercentuale: c.sconto_livello,
      });
      await fidelity.addFidelity({ codiceQr: c.codice_qr, codiceTessera: c.codice_tessera });
      return {};

    case 'promo_caricata': {
      const { rows: [pr] } = await pool.query(
        `SELECT p.titolo, p.tipo, p.valore, p.prodotto, p.valido_dal, p.valido_al, pc.id AS pc_id
           FROM promozioni_clienti pc JOIN promozioni p ON p.id = pc.promozione_id
          WHERE pc.cliente_id = $1 AND pc.promozione_id = $2`,
        [evento.cliente_id, p.promozioneId]
      );
      if (!pr) return { saltato: 'promo non più caricata' };
      if (pr.tipo === 'messaggio') return { saltato: 'promo solo messaggio, niente da applicare in cassa' };
      await fidelity.insertValueFidelity({
        codiceQr: c.codice_qr, tipo: pr.tipo, valore: pr.valore, prodotto: pr.prodotto,
        titolo: pr.titolo, validoDal: pr.valido_dal, validoAl: pr.valido_al, riferimento: `hc-${pr.pc_id}`,
      });
      return {};
    }

    case 'scansione':
      // La visita l'abbiamo già contata noi; alla cassa serve solo lo
      // sconto aggiornato del livello, se è cambiato.
      await fidelity.insertUpdateCustomer({
        codiceQr: c.codice_qr, nome: c.nome, cognome: c.cognome, telefono: c.telefono,
        email: c.email, dataNascita: c.data_nascita, scontoPercentuale: p.scontoLivello ?? c.sconto_livello,
      });
      return {};

    default:
      return { saltato: `tipo sconosciuto ${evento.tipo}` };
  }
}

async function lavora() {
  const { rows: eventi } = await pool.query(
    `SELECT id, tipo, cliente_id, payload, tentativi FROM tgs_eventi
      WHERE stato = 'in_attesa' AND prossimo_tentativo_il <= now()
      ORDER BY id LIMIT $1`,
    [LOTTO]
  );
  for (const ev of eventi) {
    try {
      const esito = await esegui(ev);
      await pool.query(
        `UPDATE tgs_eventi SET stato = 'inviato', inviato_il = now(), tentativi = tentativi + 1,
                ultimo_errore = $2 WHERE id = $1`,
        [ev.id, esito.saltato ? `saltato: ${esito.saltato}` : null]
      );
    } catch (err) {
      const tentativi = ev.tentativi + 1;
      const definitivo = err.ritentabile === false || tentativi >= MAX_TENTATIVI;
      await pool.query(
        `UPDATE tgs_eventi SET tentativi = $2, ultimo_errore = $3, stato = $4,
                prossimo_tentativo_il = now() + ($5 || ' milliseconds')::interval
          WHERE id = $1`,
        [ev.id, tentativi, String(err.message).slice(0, 500), definitivo ? 'fallito' : 'in_attesa',
         String(pausaDopo(tentativi))]
      );
      console.error(`[tgs] evento ${ev.id} (${ev.tipo}) tentativo ${tentativi}: ${err.message}${definitivo ? ' — FALLITO definitivamente' : ''}`);
      // Se la cassa non risponde, inutile insistere sugli altri adesso.
      if (err.status == null) break;
    }
  }
  return eventi.length;
}

let inCorso = false;
function avviaLavoratore() {
  const c = config.leggi();
  if (!c.abilitato) {
    console.log('[tgs] integrazione cassa spenta (TGS_ENABLED non è true)');
    return;
  }
  const mancano = config.valida(c);
  if (mancano.length) {
    console.error(`[tgs] integrazione abilitata ma configurazione incompleta: ${mancano.join(', ')} — lavoratore non avviato`);
    return;
  }
  console.log(`[tgs] integrazione cassa attiva verso ${c.baseUrl}`);
  const giro = async () => {
    if (inCorso) return;
    inCorso = true;
    try { await lavora(); } catch (err) { console.error(`[tgs] lavoratore: ${err.message}`); } finally { inCorso = false; }
  };
  setTimeout(giro, 10 * 1000).unref();
  setInterval(giro, INTERVALLO_MS).unref();
}

// Riepilogo per admin/check: quanti eventi in attesa, falliti, ultimo errore.
async function stato() {
  const { rows } = await pool.query(
    `SELECT stato, count(*)::int AS n FROM tgs_eventi GROUP BY stato`
  );
  const { rows: [ult] } = await pool.query(
    `SELECT ultimo_errore, prossimo_tentativo_il FROM tgs_eventi
      WHERE stato = 'in_attesa' AND ultimo_errore IS NOT NULL ORDER BY id DESC LIMIT 1`
  );
  const conteggi = Object.fromEntries(rows.map((r) => [r.stato, r.n]));
  return { abilitato: config.leggi().abilitato, conteggi, ultimoErrore: ult?.ultimo_errore ?? null };
}

module.exports = { accoda, lavora, avviaLavoratore, stato, MAX_TENTATIVI };
