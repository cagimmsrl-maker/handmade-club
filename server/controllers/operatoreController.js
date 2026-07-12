const pool = require('../db/pool');
const jwtService = require('../services/jwtService');
const livelloService = require('../services/livelloService');
const cassaService = require('../services/cassaService');
const { opzioniCookie } = require('../services/cookieOptions');

async function elencoSedi(req, res, next) {
  try {
    const { rows } = await pool.query(`SELECT id, nome FROM sedi WHERE attiva = true ORDER BY nome`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { sedeId, pin } = req.body;
    const { rows } = await pool.query(
      `SELECT id, nome FROM sedi WHERE id = $1 AND attiva = true AND pin_operatore = $2`,
      [sedeId, pin]
    );
    if (rows.length === 0) return res.status(401).json({ errore: 'Sede o PIN non corretti.' });

    const token = jwtService.creaTokenSessione('operatore', { sedeId: rows[0].id });
    res.cookie(jwtService.NOME_COOKIE.operatore, token, opzioniCookie('operatore'));
    res.json({ ok: true, sede: { id: rows[0].id, nome: rows[0].nome } });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie(jwtService.NOME_COOKIE.operatore, { path: '/' });
  res.json({ ok: true });
}

async function sessione(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT id, nome FROM sedi WHERE id = $1', [req.sedeId]);
    if (rows.length === 0) return res.status(401).json({ errore: 'Sede non trovata.' });
    res.json({ sede: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function scansione(req, res, next) {
  try {
    const { qrToken } = req.body;
    let payload;
    try {
      payload = jwtService.verificaTokenQr(qrToken);
    } catch {
      return res.status(400).json({ errore: 'QR non valido o scaduto. Chiedi al cliente di aggiornare la schermata.' });
    }

    const { rows: tessereRows } = await pool.query(
      `SELECT t.stato, c.id AS cliente_id, c.nome, c.stato AS cliente_stato,
              c.livello_id, c.convenzione_id
       FROM tessere t JOIN clienti c ON c.id = t.cliente_id
       WHERE t.id = $1 AND t.cliente_id = $2`,
      [payload.tesseraId, payload.clienteId]
    );
    if (tessereRows.length === 0) return res.status(404).json({ errore: 'Tessera non trovata.' });
    const info = tessereRows[0];

    if (info.stato !== 'attiva') return res.status(403).json({ errore: 'Tessera bloccata o revocata.' });
    if (info.cliente_stato !== 'attivo') return res.status(403).json({ errore: 'Account cliente non attivo.' });

    const { rows: ultimaScansione } = await pool.query(
      `SELECT id FROM scansioni
       WHERE cliente_id = $1 AND sede_id = $2 AND conteggiata = true
         AND created_at > now() - interval '2 hours'
       ORDER BY created_at DESC LIMIT 1`,
      [info.cliente_id, req.sedeId]
    );

    let esito;
    let livelloId = info.livello_id;

    if (ultimaScansione.length > 0) {
      await pool.query(
        `INSERT INTO scansioni (tessera_id, cliente_id, sede_id, livello_id, convenzione_id, conteggiata)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [payload.tesseraId, info.cliente_id, req.sedeId, info.livello_id, info.convenzione_id]
      );
      esito = 'visita_gia_registrata';
    } else {
      const { rows: inserite } = await pool.query(
        `INSERT INTO scansioni (tessera_id, cliente_id, sede_id, livello_id, convenzione_id, conteggiata)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
        [payload.tesseraId, info.cliente_id, req.sedeId, info.livello_id, info.convenzione_id]
      );
      const { livello } = await livelloService.ricalcolaLivello(info.cliente_id);
      livelloId = livello ? livello.id : info.livello_id;
      await pool.query('UPDATE scansioni SET livello_id = $1 WHERE id = $2', [livelloId, inserite[0].id]);
      esito = 'ok';
    }

    const { rows: dettaglioRows } = await pool.query(
      `SELECT l.nome AS livello_nome, l.sconto_percentuale AS livello_sconto, l.colore AS livello_colore,
              conv.nome AS convenzione_nome, conv.sconto_percentuale AS convenzione_sconto
       FROM clienti c
       LEFT JOIN livelli l ON l.id = $2
       LEFT JOIN convenzioni conv ON conv.id = c.convenzione_id AND conv.attiva = true
       WHERE c.id = $1`,
      [info.cliente_id, livelloId]
    );
    const d = dettaglioRows[0] || {};

    cassaService
      .registraScansione({
        clienteId: info.cliente_id,
        sedeId: req.sedeId,
        scontoLivello: d.livello_sconto,
        scontoConvenzione: d.convenzione_sconto,
      })
      .catch(() => {});

    res.json({
      esito,
      cliente: { nome: info.nome },
      livello: d.livello_nome ? { nome: d.livello_nome, scontoPercentuale: d.livello_sconto, colore: d.livello_colore } : null,
      convenzione: d.convenzione_nome ? { nome: d.convenzione_nome, scontoPercentuale: d.convenzione_sconto } : null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { elencoSedi, login, logout, scansione, sessione };
