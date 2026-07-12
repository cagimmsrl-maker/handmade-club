const pool = require('../db/pool');

async function elenco(req, res, next) {
  try {
    const ricerca = (req.query.search || '').trim();
    const filtro = ricerca ? `%${ricerca}%` : '%';
    const { rows } = await pool.query(
      `SELECT c.id, c.nome, c.cognome, c.telefono, c.stato,
              l.nome AS livello_nome, t.stato AS tessera_stato
       FROM clienti c
       LEFT JOIN livelli l ON l.id = c.livello_id
       LEFT JOIN tessere t ON t.cliente_id = c.id AND t.stato != 'revocata'
       WHERE c.stato != 'cancellato'
         AND (c.nome ILIKE $1 OR c.cognome ILIKE $1 OR c.telefono ILIKE $1)
       ORDER BY c.nome ASC LIMIT 50`,
      [filtro]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function bloccaTessera(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE tessere SET stato = 'bloccata' WHERE cliente_id = $1 AND stato = 'attiva'`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ errore: 'Nessuna tessera attiva trovata per questo cliente.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { elenco, bloccaTessera };
