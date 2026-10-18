const pool = require('../db/pool');
const otpService = require('../services/otpService');
const jwtService = require('../services/jwtService');
const promozioniService = require('../services/promozioniService');
const { opzioniCookie } = require('../services/cookieOptions');

function normalizzaTelefono(telefono) {
  return telefono.trim().replace(/[\s-]/g, '');
}

async function richiediOtp(req, res, next) {
  try {
    const telefono = normalizzaTelefono(req.body.telefono);
    await otpService.richiediOtp(telefono);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function verificaOtp(req, res, next) {
  try {
    const telefono = normalizzaTelefono(req.body.telefono);
    await otpService.verificaOtp(telefono, req.body.codice);

    const { rows } = await pool.query(
      `SELECT c.id, c.nome, t.id AS tessera_id
       FROM clienti c JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
       WHERE c.telefono = $1 AND c.stato != 'cancellato'`,
      [telefono]
    );

    if (rows.length > 0) {
      const cliente = rows[0];
      await pool.query('UPDATE clienti SET telefono_verificato = true WHERE id = $1', [cliente.id]);
      const token = jwtService.creaTokenSessione('cliente', { clienteId: cliente.id });
      res.cookie(jwtService.NOME_COOKIE.cliente, token, opzioniCookie('cliente'));
      return res.json({ ok: true, nuovoCliente: false });
    }

    const tokenRegistrazione = jwtService.creaTokenRegistrazione(telefono);
    res.json({ ok: true, nuovoCliente: true, tokenRegistrazione });
  } catch (err) {
    next(err);
  }
}

async function completaProfilo(req, res, next) {
  const client = await pool.connect();
  try {
    const { tokenRegistrazione, nome, cognome, email, dataNascita, consensoMarketing } = req.body;
    const { telefono } = jwtService.verificaTokenRegistrazione(tokenRegistrazione);

    await client.query('BEGIN');

    const { rows: esistente } = await client.query('SELECT id FROM clienti WHERE telefono = $1', [telefono]);
    if (esistente.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ errore: 'Numero già registrato.' });
    }

    const { rows: livelloBase } = await client.query(
      `SELECT id FROM livelli WHERE attivo = true ORDER BY soglia_visite ASC LIMIT 1`
    );

    const { rows: clienteRows } = await client.query(
      `INSERT INTO clienti
        (telefono, telefono_verificato, email, nome, cognome, data_nascita, livello_id,
         consenso_servizio_il, consenso_marketing_il)
       VALUES ($1, true, $2, $3, $4, $5, $6, now(), $7)
       RETURNING id, nome`,
      [
        telefono,
        email || null,
        nome,
        cognome || null,
        dataNascita || null,
        livelloBase[0]?.id || null,
        consensoMarketing ? new Date() : null,
      ]
    );
    const cliente = clienteRows[0];

    const codiceTessera = `HC-${String(cliente.id).padStart(6, '0')}`;
    await client.query(
      `INSERT INTO tessere (cliente_id, codice, codice_qr) VALUES ($1, $2, $3)`,
      [cliente.id, codiceTessera, promozioniService.generaCodiceQr()]
    );

    await client.query('COMMIT');

    const token = jwtService.creaTokenSessione('cliente', { clienteId: cliente.id });
    res.cookie(jwtService.NOME_COOKIE.cliente, token, opzioniCookie('cliente'));
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function logout(req, res) {
  res.clearCookie(jwtService.NOME_COOKIE.cliente, { path: '/' });
  res.json({ ok: true });
}

module.exports = { richiediOtp, verificaOtp, completaProfilo, logout };
