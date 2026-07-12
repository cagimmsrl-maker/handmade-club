const pool = require('../db/pool');

async function lista(req, res, next) {
  try {
    const { rows } = await pool.query(`SELECT * FROM convenzioni ORDER BY nome ASC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function crea(req, res, next) {
  try {
    const { nome, codiceAdesione, scontoPercentuale, note, attiva } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO convenzioni (nome, codice_adesione, sconto_percentuale, note, attiva)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome, codiceAdesione, scontoPercentuale, note || null, attiva]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ errore: 'Codice adesione già in uso.' });
    next(err);
  }
}

async function aggiorna(req, res, next) {
  try {
    const { nome, codiceAdesione, scontoPercentuale, note, attiva } = req.body;
    const { rows } = await pool.query(
      `UPDATE convenzioni SET nome=$1, codice_adesione=$2, sconto_percentuale=$3, note=$4, attiva=$5
       WHERE id = $6 RETURNING *`,
      [nome, codiceAdesione, scontoPercentuale, note || null, attiva, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Convenzione non trovata.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ errore: 'Codice adesione già in uso.' });
    next(err);
  }
}

async function elimina(req, res, next) {
  try {
    const { rowCount } = await pool.query('DELETE FROM convenzioni WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ errore: 'Convenzione non trovata.' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ errore: 'Convenzione già assegnata a clienti o scansioni: disattivala invece di eliminarla.' });
    }
    next(err);
  }
}

module.exports = { lista, crea, aggiorna, elimina };
