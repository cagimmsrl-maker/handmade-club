const pool = require('../db/pool');

async function getFinestraGiorni() {
  const { rows } = await pool.query(
    `SELECT valore FROM parametri WHERE chiave = 'finestra_visite_giorni'`
  );
  return parseInt(rows[0].valore, 10);
}

async function contaVisiteFinestra(clienteId) {
  const finestra = await getFinestraGiorni();
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM scansioni
     WHERE cliente_id = $1 AND conteggiata = true
       AND created_at > now() - ($2 || ' days')::interval`,
    [clienteId, finestra]
  );
  return rows[0].n;
}

async function trovaLivelloPerVisite(visite) {
  const { rows } = await pool.query(
    `SELECT * FROM livelli WHERE attivo = true AND soglia_visite <= $1
     ORDER BY soglia_visite DESC LIMIT 1`,
    [visite]
  );
  return rows[0] || null;
}

async function trovaProssimoLivello(visite) {
  const { rows } = await pool.query(
    `SELECT * FROM livelli WHERE attivo = true AND soglia_visite > $1
     ORDER BY soglia_visite ASC LIMIT 1`,
    [visite]
  );
  return rows[0] || null;
}

// Ricalcola e aggiorna clienti.livello_id: da chiamare ad ogni scansione valida.
async function ricalcolaLivello(clienteId) {
  const visite = await contaVisiteFinestra(clienteId);
  const livello = await trovaLivelloPerVisite(visite);
  if (livello) {
    await pool.query('UPDATE clienti SET livello_id = $1 WHERE id = $2', [livello.id, clienteId]);
  }
  return { visite, livello };
}

// Sola lettura: visite nella finestra e prossimo livello, senza toccare il DB.
async function progresso(visite) {
  const prossimo = await trovaProssimoLivello(visite);
  return {
    prossimoLivello: prossimo,
    visiteMancanti: prossimo ? Math.max(prossimo.soglia_visite - visite, 0) : null,
  };
}

module.exports = { contaVisiteFinestra, ricalcolaLivello, progresso };
