const pool = require('../db/pool');
const { NOME_COOKIE, verificaTokenSessione, creaTokenSessione } = require('../services/jwtService');
const { opzioniCookie } = require('../services/cookieOptions');

// Rinnovo automatico (19/11/2026): la sessione dura 30 giorni, ma da ora si
// rinnova a ogni uso se il token ha più di un giorno. Prima scadeva 30 giorni
// dopo la registrazione anche per chi apriva l'app ogni giorno: il cliente si
// ritrovava su "Crea la tua tessera" e per rientrare serviva il codice SMS
// (che verso alcuni operatori non arriva). Chi non apre l'app per 30 giorni
// continua a scadere, come prima.
const RINNOVA_DOPO_SECONDI = 24 * 60 * 60;

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
    const { rows } = await pool.query('SELECT sessioni_valide_da, stato FROM clienti WHERE id = $1', [payload.clienteId]);
    const da = rows[0]?.sessioni_valide_da;
    // Confronto al secondo: `iat` del JWT è in secondi interi, `sessioni_valide_da`
    // ha i millisecondi. Confrontando al millisecondo, il token emesso nello stesso
    // istante della verifica (quello di chi è appena rientrato col codice) risultava
    // "più vecchio" e veniva respinto subito (corretto il 19/11/2026).
    if (da && payload.iat < Math.floor(new Date(da).getTime() / 1000)) {
      res.clearCookie(NOME_COOKIE.cliente, { path: '/' });
      return res.status(401).json({ errore: 'Sessione non più valida. Accedi di nuovo con il codice SMS.' });
    }
    req.clienteId = payload.clienteId;
    if (rows[0]?.stato === 'attivo' && Date.now() / 1000 - payload.iat > RINNOVA_DOPO_SECONDI) {
      res.cookie(NOME_COOKIE.cliente, creaTokenSessione('cliente', { clienteId: payload.clienteId }), opzioniCookie('cliente'));
    }
    next();
  } catch (err) {
    next(err);
  }
};
