const { NOME_COOKIE, verificaTokenSessione } = require('../services/jwtService');

module.exports = function authCliente(req, res, next) {
  const token = req.cookies?.[NOME_COOKIE.cliente];
  if (!token) return res.status(401).json({ errore: 'Sessione non presente. Effettua il login.' });
  try {
    const payload = verificaTokenSessione(token, 'cliente');
    req.clienteId = payload.clienteId;
    next();
  } catch {
    res.status(401).json({ errore: 'Sessione scaduta o non valida. Effettua di nuovo il login.' });
  }
};
