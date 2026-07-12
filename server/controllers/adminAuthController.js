const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const jwtService = require('../services/jwtService');
const { opzioniCookie } = require('../services/cookieOptions');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query(
      `SELECT id, password_hash, nome FROM admin_users WHERE username = $1 AND attivo = true`,
      [username]
    );
    if (rows.length === 0) return res.status(401).json({ errore: 'Credenziali non valide.' });

    const valido = await bcrypt.compare(password, rows[0].password_hash);
    if (!valido) return res.status(401).json({ errore: 'Credenziali non valide.' });

    const token = jwtService.creaTokenSessione('admin', { adminId: rows[0].id });
    res.cookie(jwtService.NOME_COOKIE.admin, token, opzioniCookie('admin'));
    res.json({ ok: true, nome: rows[0].nome });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie(jwtService.NOME_COOKIE.admin, { path: '/' });
  res.json({ ok: true });
}

async function sessione(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT nome, username FROM admin_users WHERE id = $1', [req.adminId]);
    if (rows.length === 0) return res.status(401).json({ errore: 'Admin non trovato.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, sessione };
