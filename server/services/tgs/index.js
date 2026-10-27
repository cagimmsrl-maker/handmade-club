// Facciata dell'integrazione con la cassa TGS. Il resto dell'app usa solo
// queste funzioni, tutte "fail-open" (non lanciano mai, non bloccano):
//
//   tgs.clienteCreatoOAggiornato(clienteId)         dopo registrazione/profilo
//   tgs.promoCaricata(clienteId, promozioneId)      dopo il caricamento in bacheca
//   tgs.scansione(clienteId, sedeId, scontoLivello) dopo la lettura del QR
//
// Con TGS_ENABLED diverso da "true" non succede nulla.

const coda = require('./coda');
const client = require('./client');
const config = require('./config');

const clienteCreatoOAggiornato = (clienteId) => coda.accoda('cliente_upsert', clienteId);
const promoCaricata = (clienteId, promozioneId) => coda.accoda('promo_caricata', clienteId, { promozioneId });
const scansione = (clienteId, sedeId, scontoLivello) => coda.accoda('scansione', clienteId, { sedeId, scontoLivello });

module.exports = {
  clienteCreatoOAggiornato, promoCaricata, scansione,
  avviaLavoratore: coda.avviaLavoratore,
  stato: coda.stato,
  prova: client.prova,
  abilitato: () => config.leggi().abilitato,
};
