const pool = require('../db/pool');

async function dashboard(req, res, next) {
  try {
    const [tessereTotali, tesserePerSettimana, scansioniPerSede, distribuzioneLivelli] = await Promise.all([
      pool.query(`SELECT count(*)::int AS n FROM tessere`),
      pool.query(
        `SELECT date_trunc('week', attivata_il)::date AS settimana, count(*)::int AS n
         FROM tessere
         WHERE attivata_il > now() - interval '12 weeks'
         GROUP BY 1 ORDER BY 1`
      ),
      pool.query(
        `SELECT s.id, s.nome, count(sc.id)::int AS scansioni
         FROM sedi s
         LEFT JOIN scansioni sc ON sc.sede_id = s.id AND sc.created_at > now() - interval '30 days'
         GROUP BY s.id, s.nome ORDER BY s.nome`
      ),
      pool.query(
        `SELECT l.id, l.nome, l.colore, count(c.id)::int AS clienti
         FROM livelli l
         LEFT JOIN clienti c ON c.livello_id = l.id AND c.stato = 'attivo'
         GROUP BY l.id, l.nome, l.colore, l.ordine ORDER BY l.ordine`
      ),
    ]);

    res.json({
      tessereAttivateTotali: tessereTotali.rows[0].n,
      tessereAttivatePerSettimana: tesserePerSettimana.rows,
      scansioniPerSedeUltimi30Giorni: scansioniPerSede.rows,
      distribuzioneClientiPerLivello: distribuzioneLivelli.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };
