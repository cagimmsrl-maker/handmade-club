const pool = require('../db/pool');
const jwtService = require('../services/jwtService');
const livelloService = require('../services/livelloService');

async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT c.nome, c.cognome, c.email, c.data_nascita, c.consenso_marketing_il,
              l.nome AS livello_nome, l.colore AS livello_colore, l.sconto_percentuale AS livello_sconto,
              conv.nome AS convenzione_nome, conv.sconto_percentuale AS convenzione_sconto,
              t.codice AS tessera_codice
       FROM clienti c
       LEFT JOIN livelli l ON l.id = c.livello_id
       LEFT JOIN convenzioni conv ON conv.id = c.convenzione_id AND conv.attiva = true
       LEFT JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
       WHERE c.id = $1 AND c.stato = 'attivo'`,
      [req.clienteId]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Cliente non trovato.' });
    const r = rows[0];

    const visite = await livelloService.contaVisiteFinestra(req.clienteId);
    const { prossimoLivello, visiteMancanti } = await livelloService.progresso(visite);

    res.json({
      nome: r.nome,
      cognome: r.cognome,
      email: r.email,
      dataNascita: r.data_nascita,
      consensoMarketing: !!r.consenso_marketing_il,
      tessera: { codice: r.tessera_codice },
      livello: r.livello_nome
        ? { nome: r.livello_nome, colore: r.livello_colore, scontoPercentuale: r.livello_sconto }
        : null,
      convenzione: r.convenzione_nome
        ? { nome: r.convenzione_nome, scontoPercentuale: r.convenzione_sconto }
        : null,
      progresso: {
        visite,
        prossimoLivello: prossimoLivello ? { nome: prossimoLivello.nome, sogliaVisite: prossimoLivello.soglia_visite } : null,
        visiteMancanti,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function qrToken(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM tessere WHERE cliente_id = $1 AND stato = 'attiva'`,
      [req.clienteId]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Tessera non trovata o non attiva.' });
    const token = jwtService.creaTokenQr({ tesseraId: rows[0].id, clienteId: req.clienteId });
    res.json({ token, rotazioneSecondi: 60 });
  } catch (err) {
    next(err);
  }
}

async function aggiornaProfilo(req, res, next) {
  try {
    const { nome, cognome, email, dataNascita } = req.body;
    await pool.query(
      `UPDATE clienti SET nome = $1, cognome = $2, email = $3, data_nascita = $4 WHERE id = $5`,
      [nome, cognome || null, email || null, dataNascita || null, req.clienteId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function attivaConvenzione(req, res, next) {
  try {
    const { codice } = req.body;
    const { rows } = await pool.query(
      `SELECT id FROM convenzioni WHERE codice_adesione = $1 AND attiva = true`,
      [codice]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Codice convenzione non valido.' });
    await pool.query('UPDATE clienti SET convenzione_id = $1 WHERE id = $2', [rows[0].id, req.clienteId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function revocaConsensoMarketing(req, res, next) {
  try {
    await pool.query('UPDATE clienti SET consenso_marketing_il = NULL WHERE id = $1', [req.clienteId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function cancellaAccount(req, res, next) {
  try {
    await pool.query(
      `UPDATE clienti
       SET stato = 'cancellato', cancellato_il = now(),
           telefono = 'anonimizzato-' || id, email = NULL, nome = 'Cliente cancellato', cognome = NULL
       WHERE id = $1`,
      [req.clienteId]
    );
    await pool.query(`UPDATE tessere SET stato = 'revocata' WHERE cliente_id = $1 AND stato = 'attiva'`, [req.clienteId]);
    res.clearCookie(jwtService.NOME_COOKIE.cliente, { path: '/' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { me, qrToken, aggiornaProfilo, attivaConvenzione, revocaConsensoMarketing, cancellaAccount };
