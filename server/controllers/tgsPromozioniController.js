// TGS v2 — promozioni caricate verso la cassa e passaggi in cassa.
// Stesso modello pull della v1 (tgsController.js): è il servizio TGS a
// chiamarci, autenticato con la chiave del punto vendita (authTgs).

const pool = require('../db/pool');
const livelloService = require('../services/livelloService');
const { isoConFuso } = require('./tgsController');

const LIMITE_DEFAULT = 50;
const LIMITE_MAX = 500;

function dataIso(v) { return v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null); }
function oraHm(v) { return v ? String(v).slice(0, 5) : null; }

// GET /api/tgs/promozioni-da-sincronizzare?limite=50
// Promo caricate dai clienti (già creati in cassa per questa sede), pubblicate,
// non scadute, con un CODICE PROMOZIONE TGS (la promo è definita in cassa;
// qui si chiede solo di attivarla sulla card), destinate a questa sede o a
// tutte, senza esito per questa sede. Una riga per (cliente, promo).
async function promozioniDaSincronizzare(req, res, next) {
  try {
    const limite = Math.min(LIMITE_MAX, Math.max(1, parseInt(req.query.limite, 10) || LIMITE_DEFAULT));
    const { rows } = await pool.query(
      `SELECT pc.id, pc.caricata_il, t.codice_qr, s.tgs_codice_cliente,
              p.id AS promo_id, p.titolo, p.tipo, p.valore, p.prodotto, p.valido_dal, p.valido_al,
              p.ora_inizio, p.ora_fine, p.giorni_settimana, p.usi_per_cliente, p.codice_tgs,
              (SELECT count(*)::int FROM promozioni_utilizzi u WHERE u.promozione_id = p.id AND u.cliente_id = pc.cliente_id) AS usi
         FROM promozioni_clienti pc
         JOIN promozioni p ON p.id = pc.promozione_id
              AND p.stato = 'pubblicata' AND p.tipo <> 'messaggio' AND p.valido_al >= CURRENT_DATE
              AND p.codice_tgs IS NOT NULL AND p.codice_tgs <> ''
              AND (p.target_sede_id IS NULL OR p.target_sede_id = $1)
         JOIN clienti c ON c.id = pc.cliente_id AND c.stato = 'attivo'
         JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
         JOIN tgs_sincronizzazioni s ON s.cliente_id = c.id AND s.sede_id = $1 AND s.stato IN ('creato', 'gia_presente')
        WHERE NOT EXISTS (SELECT 1 FROM tgs_sinc_promozioni x WHERE x.promozione_cliente_id = pc.id AND x.sede_id = $1)
        ORDER BY pc.id
        LIMIT $2`,
      [req.tgs.sedeId, limite]
    );
    res.set('Cache-Control', 'no-store');
    res.json({
      promozioni: rows.map((r) => ({
        id: String(r.id),                               // id della promo caricata (stabile)
        qrCode: r.codice_qr,
        codiceClienteTgs: r.tgs_codice_cliente || null,  // quello che TGS ci ha dato all'esito cliente
        caricataIl: isoConFuso(r.caricata_il),
        codicePromozioneTgs: r.codice_tgs,              // la promozione definita in TGS da attivare sulla card
        promozione: {                                    // solo informativo: la definizione vera è in TGS
          id: String(r.promo_id),
          titolo: String(r.titolo).slice(0, 100),
          tipo: r.tipo,                                 // sconto_percentuale | prezzo_fisso | omaggio
          valore: r.valore == null ? null : Number(r.valore),
          prodotto: r.prodotto || null,
          validoDal: dataIso(r.valido_dal),
          validoAl: dataIso(r.valido_al),
          oraInizio: oraHm(r.ora_inizio),
          oraFine: oraHm(r.ora_fine),
          giorniSettimana: r.giorni_settimana || null,   // 0 = domenica … 6 = sabato; null = tutti
          usiPerCliente: r.usi_per_cliente,              // null = illimitati
          usiResidui: r.usi_per_cliente == null ? null : Math.max(0, r.usi_per_cliente - r.usi),
        },
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/tgs/promozioni/:id/esito  { esito: attivata|errore, messaggio, elaboratoIl } → 204
// ('creata' accettato come sinonimo di 'attivata' per compatibilità)
async function esitoPromozione(req, res, next) {
  try {
    const pcId = parseInt(req.params.id, 10);
    if (!Number.isInteger(pcId)) return res.status(404).json({ errore: 'Promozione caricata non trovata.' });
    const { rows } = await pool.query('SELECT 1 FROM promozioni_clienti WHERE id = $1', [pcId]);
    if (rows.length === 0) return res.status(404).json({ errore: 'Promozione caricata non trovata.' });
    const e = req.body;
    await pool.query(
      `INSERT INTO tgs_sinc_promozioni (promozione_cliente_id, sede_id, stato, tgs_codice_promozione, messaggio, elaborato_il)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (promozione_cliente_id, sede_id) DO UPDATE SET
         stato = EXCLUDED.stato,
         tgs_codice_promozione = COALESCE(EXCLUDED.tgs_codice_promozione, tgs_sinc_promozioni.tgs_codice_promozione),
         messaggio = EXCLUDED.messaggio,
         elaborato_il = COALESCE(EXCLUDED.elaborato_il, tgs_sinc_promozioni.elaborato_il),
         esiti_ricevuti = tgs_sinc_promozioni.esiti_ricevuti + 1,
         ultimo_esito_il = now()`,
      [pcId, req.tgs.sedeId, e.esito, e.codicePromozioneTgs, e.messaggio, e.elaboratoIl]
    );
    if (e.esito === 'errore') console.error(`[tgs] esito errore promo caricata ${pcId} (sede ${req.tgs.sedeNome}): ${e.messaggio || 'senza dettaglio'}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// POST /api/tgs/passaggi
// { numeroScontrino, qrCode, passatoIl, totale?, promozioniUsate?: [id promo caricata] } → 204
// È la lettura del QR fatta dalla cassa: registra la visita (con la stessa
// regola anti-doppione delle 2 ore della schermata operatore), ricalcola il
// livello e segna usate le promo indicate. Idempotente per (sede, scontrino).
async function passaggio(req, res, next) {
  const client = await pool.connect();
  try {
    const b = req.body;
    const { rows: tess } = await client.query(
      `SELECT t.id AS tessera_id, c.id AS cliente_id, c.livello_id, c.convenzione_id
         FROM tessere t JOIN clienti c ON c.id = t.cliente_id
        WHERE t.codice_qr = $1 AND t.stato = 'attiva' AND c.stato = 'attivo'`,
      [String(b.qrCode).toUpperCase()]
    );
    if (tess.length === 0) return res.status(404).json({ errore: 'QR code non riconosciuto o tessera non attiva.' });
    const t = tess[0];

    await client.query('BEGIN');
    // Idempotenza: stesso scontrino per la stessa sede → nulla da fare.
    const { rows: giaVisto } = await client.query(
      `SELECT id FROM tgs_passaggi WHERE sede_id = $1 AND numero_scontrino = $2 FOR UPDATE`,
      [req.tgs.sedeId, b.numeroScontrino]
    );
    if (giaVisto.length > 0) { await client.query('ROLLBACK'); return res.status(204).end(); }

    const { rows: recenti } = await client.query(
      `SELECT 1 FROM scansioni WHERE cliente_id = $1 AND sede_id = $2 AND conteggiata = true
          AND created_at > $3::timestamptz - interval '2 hours' AND created_at <= $3::timestamptz LIMIT 1`,
      [t.cliente_id, req.tgs.sedeId, b.passatoIl]
    );
    const conteggiata = recenti.length === 0;
    const { rows: [sc] } = await client.query(
      `INSERT INTO scansioni (tessera_id, cliente_id, sede_id, livello_id, convenzione_id, conteggiata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [t.tessera_id, t.cliente_id, req.tgs.sedeId, t.livello_id, t.convenzione_id, conteggiata, b.passatoIl]
    );

    // Promo usate: solo quelle caricate da QUESTO cliente (mai fidarsi dell'id e basta).
    const usate = [];
    for (const idStr of b.promozioniUsate || []) {
      const pcId = parseInt(idStr, 10);
      if (!Number.isInteger(pcId)) continue;
      const { rows: pc } = await client.query(
        `SELECT pc.promozione_id FROM promozioni_clienti pc WHERE pc.id = $1 AND pc.cliente_id = $2`,
        [pcId, t.cliente_id]
      );
      if (pc.length === 0) continue;
      await client.query(
        `INSERT INTO promozioni_utilizzi (promozione_id, cliente_id, sede_id, usata_il) VALUES ($1, $2, $3, $4)`,
        [pc[0].promozione_id, t.cliente_id, req.tgs.sedeId, b.passatoIl]
      );
      usate.push(pcId);
    }

    await client.query(
      `INSERT INTO tgs_passaggi (sede_id, cliente_id, numero_scontrino, totale, passato_il, scansione_id, promozioni_usate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.tgs.sedeId, t.cliente_id, b.numeroScontrino, b.totale ?? null, b.passatoIl, sc.id, usate]
    );
    await client.query('COMMIT');

    if (conteggiata) {
      const { livello } = await livelloService.ricalcolaLivello(t.cliente_id);
      if (livello) await pool.query('UPDATE scansioni SET livello_id = $1 WHERE id = $2', [livello.id, sc.id]);
    }
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { promozioniDaSincronizzare, esitoPromozione, passaggio };
