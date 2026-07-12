// Gestore errori centralizzato. Non logga mai body/payload delle richieste
// (potrebbero contenere OTP, password, telefono) per rispettare CLAUDE.md
// ("nessun dato sensibile nei log") — solo messaggio ed eventuale status.
module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) {
    console.error(`[errore] ${req.method} ${req.path} — ${err.message}`);
  }
  res.status(status).json({ errore: err.message || 'Errore interno del server.' });
};
