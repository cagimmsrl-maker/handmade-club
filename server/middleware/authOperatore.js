const { NOME_COOKIE, verificaTokenSessione } = require('../services/jwtService');

module.exports = function authOperatore(req, res, next) {
  const token = req.cookies?.[NOME_COOKIE.operatore];
  if (!token) return res.status(401).json({ errore: 'Sessione operatore non presente.' });
  try {
    const payload = verificaTokenSessione(token, 'operatore');
    req.sedeId = payload.sedeId;
    next();
  } catch {
    res.status(401).json({ errore: 'Sessione operatore scaduta o non valida.' });
  }
};
