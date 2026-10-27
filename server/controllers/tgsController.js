// API che il servizio TGS (accanto alla cassa) chiama ogni ~10 s. Vedi la
// migrazione 008 per il modello. Lunghezze massime allineate ai campi TGS:
// telefono 15, nome/cognome 100, e-mail 100, QR 50.

const pool = require('../db/pool');

const LIMITE_DEFAULT = 100;
const LIMITE_MAX = 500;

function taglia(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

// GET /api/tgs/clienti-da-sincronizzare?limite=100
// Clienti attivi con tessera attiva che per QUESTA sede non hanno ancora un
// esito 'creato' o 'gia_presente'. Gli 'errore' restano fuori (altrimenti
// girerebbero all'infinito): si riprovano dall'admin togliendo la riga.
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
      sede: req.tgs.sedeNome,
      clienti: rows.map((r) => ({
        id: r.id,
        nome: taglia(r.nome, 100),
        cognome: taglia(r.cognome, 100) || '',
        telefono: taglia(r.telefono, 15),
        email: r.email && String(r.email).trim().length <= 100 ? String(r.email).trim() : null, // TGS: max 100; una mail tagliata sarebbe falsa
        qr: taglia(r.codice_qr, 50),
        data: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/tgs/clienti/:id/esito  { esito, codice_cliente_tgs, codice_card, numero_pay, messaggio }
// Idempotente: un esito ripetuto aggiorna la stessa riga (cliente, sede).
async function esito(req, res, next) {
  try {
    const clienteId = parseInt(req.params.id, 10);
    if (!Number.isInteger(clienteId)) return res.status(400).json({ errore: 'Id cliente non valido.' });
    const { rows: esiste } = await pool.query(`SELECT 1 FROM clienti WHERE id = $1`, [clienteId]);
    if (esiste.length === 0) return res.status(404).json({ errore: 'Cliente non trovato.' });

    const e = req.body;
    const { rows: [r] } = await pool.query(
      `INSERT INTO tgs_sincronizzazioni
         (cliente_id, sede_id, stato, tgs_codice_cliente, tgs_codice_card, tgs_numero_pay, messaggio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (cliente_id, sede_id) DO UPDATE SET
         stato = EXCLUDED.stato,
         tgs_codice_cliente = COALESCE(EXCLUDED.tgs_codice_cliente, tgs_sincronizzazioni.tgs_codice_cliente),
         tgs_codice_card    = COALESCE(EXCLUDED.tgs_codice_card,    tgs_sincronizzazioni.tgs_codice_card),
         tgs_numero_pay     = COALESCE(EXCLUDED.tgs_numero_pay,     tgs_sincronizzazioni.tgs_numero_pay),
         messaggio = EXCLUDED.messaggio,
         esiti_ricevuti = tgs_sincronizzazioni.esiti_ricevuti + 1,
         ultimo_esito_il = now()
       RETURNING esiti_ricevuti`,
      [clienteId, req.tgs.sedeId, e.esito, e.codiceClienteTgs, e.codiceCard, e.numeroPay, e.messaggio]
    );
    if (e.esito === 'errore') console.error(`[tgs] esito errore per cliente ${clienteId} (sede ${req.tgs.sedeNome}): ${e.messaggio || 'senza dettaglio'}`);
    res.json({ ok: true, ripetuto: r.esiti_ricevuti > 1 });
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
              (SELECT count(*)::int FROM tgs_chiavi_api k WHERE k.sede_id = s.id AND k.attiva) AS chiavi_attive
         FROM sedi s WHERE s.attiva = true ORDER BY s.nome`
    );
    const { rows: errori } = await pool.query(
      `SELECT x.cliente_id, c.nome, c.cognome, s.nome AS sede, x.messaggio, x.ultimo_esito_il
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

module.exports = { clientiDaSincronizzare, esito, riepilogoAdmin, riprovaAdmin };
