// Conservazione dei dati (vedi informativa, "Per quanto tempo"): i clienti
// senza alcuna attività da 24 mesi vengono anonimizzati come se avessero
// cancellato l'account. Attività = iscrizione, visita alla cassa,
// promozione caricata. Gira una volta al giorno dentro al processo.

const pool = require('../db/pool');

const MESI_INATTIVITA = 24;

async function anonimizzaInattivi() {
  const { rows } = await pool.query(
    `WITH inattivi AS (
       SELECT c.id FROM clienti c
        WHERE c.stato = 'attivo'
          AND c.created_at < now() - ($1 || ' months')::interval
          AND NOT EXISTS (SELECT 1 FROM scansioni s WHERE s.cliente_id = c.id AND s.created_at > now() - ($1 || ' months')::interval)
          AND NOT EXISTS (SELECT 1 FROM promozioni_clienti pc WHERE pc.cliente_id = c.id AND pc.caricata_il > now() - ($1 || ' months')::interval)
     ), agg AS (
       UPDATE clienti c SET stato = 'cancellato', cancellato_il = now(),
              telefono = 'anonimizzato-' || c.id, email = NULL, nome = 'Cliente inattivo', cognome = NULL, data_nascita = NULL
         FROM inattivi WHERE c.id = inattivi.id RETURNING c.id
     )
     UPDATE tessere t SET stato = 'revocata' FROM agg WHERE t.cliente_id = agg.id AND t.stato = 'attiva' RETURNING t.cliente_id`,
    [String(MESI_INATTIVITA)]
  );
  if (rows.length > 0) console.log(`[pulizie] anonimizzati ${rows.length} clienti inattivi da ${MESI_INATTIVITA} mesi`);
  return rows.length;
}

function avviaPulizieGiornaliere() {
  const esegui = () => anonimizzaInattivi().catch((err) => console.error(`[pulizie] errore: ${err.message}`));
  setTimeout(esegui, 5 * 60 * 1000).unref();
  setInterval(esegui, 24 * 60 * 60 * 1000).unref();
}

module.exports = { anonimizzaInattivi, avviaPulizieGiornaliere, MESI_INATTIVITA };
