const pool = require('../db/pool');

async function leggi(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT valore FROM parametri WHERE chiave = 'finestra_visite_giorni'`
    );
    res.json({ finestraVisiteGiorni: parseInt(rows[0].valore, 10) });
  } catch (err) {
    next(err);
  }
}

async function aggiorna(req, res, next) {
  try {
    const { finestraVisiteGiorni } = req.body;
    await pool.query(
      `UPDATE parametri SET valore = $1 WHERE chiave = 'finestra_visite_giorni'`,
      [String(finestraVisiteGiorni)]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { leggi, aggiorna };
