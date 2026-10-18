const pool = require('../db/pool');
const { NOME_COOKIE, verificaTokenSessione } = require('../services/jwtService');

// Oltre alla firma del JWT, controlla clienti.sessioni_valide_da: quando il
// titolare verifica un numero registrato senza OTP, tutte le sessioni
// emesse prima vengono rifiutate (vedi migrazione 004).
module.exports = async function authCliente(req, res, next) {
  const token = req.cookies?.[NOME_COOKIE.cliente];
  if (!token) return res.status(401).json({ errore: 'Sessione non presente. Effettua il login.' });
  let payload;
  try {
    payload = verificaTokenSessione(token, 'cliente');
  } catch {
    return res.status(401).json({ errore: 'Sessione scaduta o non valida. Effettua di nuovo il login.' });
  }
  try {
    const { rows } = await pool.query('SELECT sessioni_valide_da FROM clienti WHERE id = $1', [payload.clienteId]);
    const da = rows[0]?.sessioni_valide_da;
    if (da && payload.iat * 1000 < new Date(da).getTime()) {
      res.clearCookie(NOME_COOKIE.cliente, { path: '/' });
      return res.status(401).json({ errore: 'Sessione non più valida. Accedi di nuovo con il codice SMS.' });
    }
    req.clienteId = payload.clienteId;
    next();
  } catch (err) {
    next(err);
  }
};
