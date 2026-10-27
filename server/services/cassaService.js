// Punto di aggancio isolato tra la scansione e la cassa TGS. Resta il
// contratto di Tappa 1: non lancia mai eccezioni e non blocca la scansione
// (fail-open). Da Tappa 2 delega a services/tgs, che con TGS_ENABLED
// spento non fa nulla.

const tgs = require('./tgs');

async function registraScansione({ clienteId, sedeId, scontoLivello, scontoConvenzione }) {
  if (!tgs.abilitato()) {
    console.log(
      `[cassaService] cliente=${clienteId} sede=${sedeId} sconto_livello=${scontoLivello}% ` +
      `sconto_convenzione=${scontoConvenzione ?? 0}% — integrazione TGS spenta`
    );
    return;
  }
  await tgs.scansione(clienteId, sedeId, scontoLivello);
}

module.exports = { registraScansione };
