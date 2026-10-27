// Autenticazione del servizio TGS che chiama la nostra app (modello pull):
// intestazione X-Api-Key, una chiave per punto vendita (tgs_chiavi_api,
// migrazione 008). Nel DB c'è solo l'hash SHA-256: la chiave in chiaro non
// è mai salvata né loggata. Confronto a tempo costante. In caso di
// rifiuto si risponde sempre allo stesso modo, senza dire perché.

const crypto = require('crypto');
const pool = require('../db/pool');

function hashChiave(chiave) {
  return crypto.createHash('sha256').update(String(chiave), 'utf8').digest('hex');
}

module.exports = async function authTgs(req, res, next) {
  const chiave = req.get('X-Api-Key');
  if (!chiave || chiave.length < 16 || chiave.length > 200) {
    return res.status(401).json({ errore: 'Chiave API mancante o non valida.' });
  }
  try {
    const hash = hashChiave(chiave);
    const { rows } = await pool.query(
      `SELECT k.id, k.sede_id, k.chiave_hash, s.nome AS sede_nome
         FROM tgs_chiavi_api k JOIN sedi s ON s.id = k.sede_id
        WHERE k.chiave_hash = $1 AND k.attiva = true AND s.attiva = true`,
      [hash]
    );
    const k = rows[0];
    const ok = k && crypto.timingSafeEqual(Buffer.from(k.chiave_hash), Buffer.from(hash));
    if (!ok) return res.status(401).json({ errore: 'Chiave API mancante o non valida.' });
    req.tgs = { chiaveId: k.id, sedeId: k.sede_id, sedeNome: k.sede_nome };
    // Traccia dell'ultimo uso (per vedere dall'admin se il servizio TGS sta girando).
    pool.query('UPDATE tgs_chiavi_api SET ultimo_uso_il = now() WHERE id = $1', [k.id]).catch(() => {});
    next();
  } catch (err) {
    next(err);
  }
};

module.exports.hashChiave = hashChiave;
