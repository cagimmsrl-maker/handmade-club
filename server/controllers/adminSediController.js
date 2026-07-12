const pool = require('../db/pool');

async function lista(req, res, next) {
  try {
    const { rows } = await pool.query(`SELECT * FROM sedi ORDER BY nome ASC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function crea(req, res, next) {
  try {
    const { nome, indirizzo, pinOperatore, attiva } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO sedi (nome, indirizzo, pin_operatore, attiva) VALUES ($1, $2, $3, $4) RETURNING *`,
      [nome, indirizzo || null, pinOperatore, attiva]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function aggiorna(req, res, next) {
  try {
    const { nome, indirizzo, pinOperatore, attiva } = req.body;
    const { rows } = await pool.query(
      `UPDATE sedi SET nome=$1, indirizzo=$2, pin_operatore=$3, attiva=$4 WHERE id = $5 RETURNING *`,
      [nome, indirizzo || null, pinOperatore, attiva, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Sede non trovata.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function elimina(req, res, next) {
  try {
    const { rowCount } = await pool.query('DELETE FROM sedi WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ errore: 'Sede non trovata.' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ errore: 'Sede già utilizzata in scansioni o prenotazioni: disattivala invece di eliminarla.' });
    }
    next(err);
  }
}

module.exports = { lista, crea, aggiorna, elimina };
