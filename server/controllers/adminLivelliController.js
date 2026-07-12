const pool = require('../db/pool');

async function lista(req, res, next) {
  try {
    const { rows } = await pool.query(`SELECT * FROM livelli ORDER BY ordine ASC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function crea(req, res, next) {
  try {
    const { nome, sogliaVisite, scontoPercentuale, colore, ordine, attivo } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO livelli (nome, soglia_visite, sconto_percentuale, colore, ordine, attivo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome, sogliaVisite, scontoPercentuale, colore || null, ordine, attivo]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function aggiorna(req, res, next) {
  try {
    const { nome, sogliaVisite, scontoPercentuale, colore, ordine, attivo } = req.body;
    const { rows } = await pool.query(
      `UPDATE livelli SET nome=$1, soglia_visite=$2, sconto_percentuale=$3, colore=$4, ordine=$5, attivo=$6
       WHERE id = $7 RETURNING *`,
      [nome, sogliaVisite, scontoPercentuale, colore || null, ordine, attivo, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Livello non trovato.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function elimina(req, res, next) {
  try {
    const { rowCount } = await pool.query('DELETE FROM livelli WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ errore: 'Livello non trovato.' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ errore: 'Livello già assegnato a clienti o scansioni: disattivalo invece di eliminarlo.' });
    }
    next(err);
  }
}

module.exports = { lista, crea, aggiorna, elimina };
