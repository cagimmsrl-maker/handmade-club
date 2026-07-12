// Punto di aggancio isolato per l'integrazione futura con le casse TGS Retail.
// In Tappa 1 logga soltanto: nessuna chiamata reale deve mai bloccare la
// scansione (fail-open), quindi questo service non lancia mai eccezioni.

async function registraScansione({ clienteId, sedeId, scontoLivello, scontoConvenzione }) {
  console.log(
    `[cassaService] cliente=${clienteId} sede=${sedeId} sconto_livello=${scontoLivello}% ` +
    `sconto_convenzione=${scontoConvenzione ?? 0}% — integrazione TGS non ancora attiva`
  );
}

module.exports = { registraScansione };
