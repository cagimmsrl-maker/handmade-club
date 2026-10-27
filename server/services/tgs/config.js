// Configurazione dell'integrazione con la cassa TGS Retail (WebService
// "websrv", modulo Fidelity). Tutto arriva dal .env; finché TGS_ENABLED
// non è "true" l'integrazione è spenta: gli agganci nel codice non fanno
// nulla e il lavoratore della coda non parte. Così si può deployare
// l'ossatura senza alcun effetto in produzione.
//
// Cosa sappiamo del servizio (ricognizione sul server di Fiano, 27/10/2026):
//  - gira su 192.168.10.10 porta 9010 (Kestrel/ASP.NET), raggiunto da fuori
//    tramite inoltro 5.154.199.20:9443 → 192.168.10.10:9010;
//  - autenticazione a token JWT Bearer;
//  - operazioni del modulo Fidelity: GetCustomer, InsertUpdateCustomer,
//    AddFidelity, GetValueFidelity, InsertValueFidelity.
// Percorsi esatti, parametri ed endpoint di login: DA CONFERMARE CON TGS
// (vedi fidelity.js).

function leggi() {
  const abilitato = String(process.env.TGS_ENABLED || '').toLowerCase() === 'true';
  const baseUrl = (process.env.TGS_BASE_URL || '').replace(/\/+$/, '');
  return {
    abilitato,
    baseUrl,                                             // es. https://5.154.199.20:9443
    utente: process.env.TGS_USER || '',
    password: process.env.TGS_PASSWORD || '',
    // Il certificato del WebService sarà quasi certamente autofirmato: si
    // accetta SOLO se si indica qui la sua impronta, mai "qualunque".
    impronta: process.env.TGS_CERT_FINGERPRINT || '',
    timeoutMs: Number(process.env.TGS_TIMEOUT_MS || 4000),
    // Codice con cui TGS identifica questo punto vendita (per la coda
    // multi-sede in futuro: oggi un solo server, Fiano).
    codiceSede: process.env.TGS_CODICE_SEDE || '',
  };
}

function valida(c) {
  const mancano = [];
  if (!c.baseUrl) mancano.push('TGS_BASE_URL');
  if (!c.utente) mancano.push('TGS_USER');
  if (!c.password) mancano.push('TGS_PASSWORD');
  return mancano;
}

module.exports = { leggi, valida };
