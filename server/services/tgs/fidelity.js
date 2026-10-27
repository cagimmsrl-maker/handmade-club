// Le 5 operazioni del modulo Fidelity del WebService TGS, tradotte dal
// nostro dominio al loro. I NOMI delle operazioni sono certi (letti dal
// modulo installato sul server di Fiano); PERCORSI, METODI HTTP e NOMI DEI
// CAMPI sono ipotesi di lavoro da sostituire con la specifica di TGS:
// ogni punto è marcato "DA CONFERMARE CON TGS". Tutto ciò che è TGS-specifico
// sta in questo file: il resto del codice non deve cambiare quando arriva
// la documentazione.

const client = require('./client');

// Percorsi: sovrascrivibili dal .env senza toccare il codice, così la
// conferma di TGS si applica in produzione con un restart e basta.
const P = {
  getCustomer:          process.env.TGS_PATH_GET_CUSTOMER          || '/api/Fidelity/GetCustomer',          // DA CONFERMARE CON TGS
  insertUpdateCustomer: process.env.TGS_PATH_INSERT_UPDATE_CUSTOMER || '/api/Fidelity/InsertUpdateCustomer', // DA CONFERMARE CON TGS
  addFidelity:          process.env.TGS_PATH_ADD_FIDELITY           || '/api/Fidelity/AddFidelity',          // DA CONFERMARE CON TGS
  getValueFidelity:     process.env.TGS_PATH_GET_VALUE_FIDELITY     || '/api/Fidelity/GetValueFidelity',     // DA CONFERMARE CON TGS
  insertValueFidelity:  process.env.TGS_PATH_INSERT_VALUE_FIDELITY  || '/api/Fidelity/InsertValueFidelity',  // DA CONFERMARE CON TGS
};

// Il codice con cui la cassa riconosce il cliente è il nostro QR statico
// (tessere.codice_qr, 12 esadecimali): è l'unico identificativo che TGS
// deve conoscere di noi.

// Cerca un cliente per codice tessera. Restituisce null se non esiste.
async function getCustomer(codiceQr) {
  try {
    // DA CONFERMARE CON TGS: GET con query string o POST con corpo?
    return await client.chiama('GET', `${P.getCustomer}?card=${encodeURIComponent(codiceQr)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Crea o aggiorna l'anagrafica del cliente in cassa.
async function insertUpdateCustomer({ codiceQr, nome, cognome, telefono, email, dataNascita, scontoPercentuale }) {
  const corpo = {
    // DA CONFERMARE CON TGS: nomi dei campi
    card: codiceQr,
    firstName: nome,
    lastName: cognome || '',
    phone: telefono,
    email: email || '',
    birthDate: dataNascita || null,
    discount: scontoPercentuale ?? 0,     // sconto del livello, se la cassa lo tiene sul cliente
  };
  return client.chiama('POST', P.insertUpdateCustomer, corpo);
}

// Associa la tessera (il QR) al cliente, se per TGS sono due passi distinti.
async function addFidelity({ codiceQr, codiceTessera }) {
  return client.chiama('POST', P.addFidelity, {
    card: codiceQr,              // DA CONFERMARE CON TGS
    description: codiceTessera,  // il nostro HC-000042, solo come etichetta leggibile
  });
}

// Legge il "valore" della tessera (punti, saldo prepagato…).
async function getValueFidelity(codiceQr) {
  return client.chiama('GET', `${P.getValueFidelity}?card=${encodeURIComponent(codiceQr)}`); // DA CONFERMARE CON TGS
}

// Scrive un valore sulla tessera: è qui che passa una promozione caricata
// (sconto %, prezzo fisso, omaggio) o una ricarica prepagata.
// tipo: 'sconto_percentuale' | 'prezzo_fisso' | 'omaggio' | 'ricarica'
async function insertValueFidelity({ codiceQr, tipo, valore, prodotto, titolo, validoDal, validoAl, riferimento }) {
  const corpo = {
    // DA CONFERMARE CON TGS: nomi dei campi e codifica del tipo
    card: codiceQr,
    type: tipo,
    value: valore ?? null,
    article: prodotto || null,   // per prezzo fisso/omaggio servirà il LORO codice articolo
    description: titolo || '',
    validFrom: validoDal || null,
    validTo: validoAl || null,
    reference: riferimento || null, // nostro id (promozioni_clienti.id) per idempotenza
  };
  return client.chiama('POST', P.insertValueFidelity, corpo);
}

module.exports = { getCustomer, insertUpdateCustomer, addFidelity, getValueFidelity, insertValueFidelity, PERCORSI: P };
