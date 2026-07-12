const { NOME_COOKIE, verificaTokenSessione } = require('../services/jwtService');

module.exports = function authAdmin(req, res, next) {
  const token = req.cookies?.[NOME_COOKIE.admin];
  if (!token) return res.status(401).json({ errore: 'Sessione admin non presente.' });
  try {
    const payload = verificaTokenSessione(token, 'admin');
    req.adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json({ errore: 'Sessione admin scaduta o non valida.' });
  }
};
