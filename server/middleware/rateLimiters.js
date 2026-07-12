const rateLimit = require('express-rate-limit');

// 5 richieste / 15 minuti per IP, come da CLAUDE.md, su tutte le rotte
// pubbliche sensibili (OTP, login operatore, login admin).
function limitatorePubblico() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errore: 'Troppe richieste. Riprova tra qualche minuto.' },
  });
}

module.exports = { limitatorePubblico };
