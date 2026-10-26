const rateLimit = require('express-rate-limit');

// Limiti per IP. Attenzione: in un locale tutti i clienti sul Wi-Fi del bar
// (o sui totem) escono con LO STESSO indirizzo IP, e anche le reti mobili
// raggruppano molti telefoni dietro un solo IP (CGNAT). I limiti per IP
// sono quindi una rete di sicurezza contro gli abusi automatici, non il
// controllo principale: quello sta nelle regole per numero di telefono
// (otpService: max richieste per numero, 3 tentativi per codice).

function crea(max, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errore: 'Troppe richieste. Riprova tra qualche minuto.' },
  });
}

// Login admin e operatore (password / PIN): pochi tentativi, come da CLAUDE.md.
function limitatorePubblico() {
  return crea(5);
}

// Registrazione: nessun SMS, costo basso; il numero è unico, quindi un
// abuso crea al massimo account vuoti. 120 ogni 15 minuti per IP reggono
// una serata di apertura con hostess e totem.
function limitatoreRegistrazione() {
  return crea(120);
}

// Richiesta/verifica OTP: il tetto vero è per numero (otpService); per IP
// serve solo a fermare chi martella con numeri sempre diversi.
function limitatoreOtp() {
  return crea(40);
}

module.exports = { limitatorePubblico, limitatoreRegistrazione, limitatoreOtp };
