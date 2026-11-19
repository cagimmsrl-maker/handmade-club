const pool = require('../db/pool');
const otpService = require('../services/otpService');

async function elenco(req, res, next) {
  try {
    const ricerca = (req.query.search || '').trim();
    const filtro = ricerca ? `%${ricerca}%` : '%';
    const { rows } = await pool.query(
      `SELECT c.id, c.nome, c.cognome, c.telefono, c.stato,
              l.nome AS livello_nome, t.stato AS tessera_stato,
              COALESCE((SELECT json_agg(json_build_object('sede', s.nome, 'stato', x.stato, 'messaggio', x.messaggio, 'card', x.tgs_numero_pay) ORDER BY s.nome)
                          FROM tgs_sincronizzazioni x JOIN sedi s ON s.id = x.sede_id WHERE x.cliente_id = c.id), '[]'::json) AS tgs
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

// Tessere per canale di acquisizione (clienti.origine, migrazione 015):
// totale e ultimi 30 giorni. NULL = "banco / non noto".
async function origini(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(origine, 'banco') AS origine,
              COUNT(*)::int AS totale,
              COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS ultimi_30_giorni
       FROM clienti WHERE stato <> 'cancellato'
       GROUP BY 1 ORDER BY 2 DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Codice di accesso per un cliente che deve rientrare nell'app e non riceve
// l'SMS (19/11/2026). L'admin lo legge al cliente o glielo manda su WhatsApp;
// il cliente lo inserisce nella schermata "Ho già la tessera" al posto di
// quello SMS. Chi lo genera garantisce che il numero è del cliente: al primo
// uso il numero risulta verificato, come con l'SMS. Nel log solo il cliente.
async function codiceAccesso(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, telefono FROM clienti WHERE id = $1 AND stato = 'attivo'`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ errore: 'Cliente non trovato o non attivo.' });
    const esito = await otpService.codiceDaAdmin(rows[0].telefono);
    console.log(`[accesso] codice di accesso generato dall'admin ${req.adminId ?? '?'} per il cliente ${rows[0].id}`);
    res.json(esito);
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

// Elenco dei clienti con consenso marketing attivo, in CSV, per le
// comunicazioni fatte a mano (es. WhatsApp dal telefono del locale). SOLO
// chi ha prestato il consenso e non l'ha revocato: gli altri non si
// contattano. Telefono in formato internazionale, pronto da salvare.
async function esportaMarketing(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT c.nome, c.cognome, c.telefono, c.created_at, c.consenso_marketing_il
       FROM clienti c
       WHERE c.stato = 'attivo' AND c.consenso_marketing_il IS NOT NULL AND c.consenso_marketing_revocato_il IS NULL
       ORDER BY c.created_at`
    );
    const pulisci = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const tel = (t) => {
      const cifre = String(t || '').replace(/\D/g, '');
      return cifre.startsWith('39') ? `+${cifre}` : `+39${cifre}`;
    };
    const righe = [
      ['Nome', 'Cognome', 'Telefono', 'Iscritto il', 'Consenso marketing il'].join(';'),
      ...rows.map((r) => [
        pulisci(r.nome), pulisci(r.cognome), pulisci(tel(r.telefono)),
        pulisci(new Date(r.created_at).toLocaleDateString('it-IT')),
        pulisci(new Date(r.consenso_marketing_il).toLocaleDateString('it-IT')),
      ].join(';')),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clienti-consenso-marketing-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\ufeff' + righe.join('\r\n'));
  } catch (err) {
    next(err);
  }
}

module.exports = { elenco, bloccaTessera, esportaMarketing, origini, codiceAccesso };
