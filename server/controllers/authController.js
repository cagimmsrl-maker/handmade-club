const pool = require('../db/pool');
const otpService = require('../services/otpService');
const jwtService = require('../services/jwtService');
const promozioniService = require('../services/promozioniService');
const { INFORMATIVA_VERSIONE } = require('../config/privacy');
const tgs = require('../services/tgs');
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
      // Chi supera l'OTP è il titolare del numero. Se l'account era stato
      // creato senza verifica (registrazione immediata), le sessioni
      // aperte prima di adesso — compresa quella di chi l'ha creato —
      // vengono invalidate: da qui in poi comanda solo il titolare.
      await pool.query(
        `UPDATE clienti
            SET telefono_verificato = true,
                sessioni_valide_da = CASE WHEN telefono_verificato THEN sessioni_valide_da ELSE now() END
          WHERE id = $1`,
        [cliente.id]
      );
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
         consenso_servizio_il, consenso_marketing_il, informativa_versione)
       VALUES ($1, true, $2, $3, $4, $5, $6, now(), $7, $8)
       RETURNING id, nome`,
      [
        telefono,
        email || null,
        nome,
        cognome || null,
        dataNascita || null,
        livelloBase[0]?.id || null,
        consensoMarketing ? new Date() : null,
        INFORMATIVA_VERSIONE,
      ]
    );
    const cliente = clienteRows[0];

    const codiceTessera = `HC-${String(cliente.id).padStart(6, '0')}`;
    await client.query(
      `INSERT INTO tessere (cliente_id, codice, codice_qr) VALUES ($1, $2, $3)`,
      [cliente.id, codiceTessera, promozioniService.generaCodiceQr()]
    );

    await client.query('COMMIT');
    tgs.clienteCreatoOAggiornato(cliente.id);

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

// POST /auth/registra — registrazione immediata senza OTP: il cliente ha la
// tessera in 10 secondi. telefono_verificato resta false finché non
// conferma il numero (dal profilo, o quando carica una promo). Se il
// numero è già registrato si rimanda al login con codice: solo chi riceve
// l'OTP può entrare in un account esistente.
async function registra(req, res, next) {
  const client = await pool.connect();
  try {
    const { nome, cognome, email, dataNascita, consensoMarketing } = req.body;
    const telefono = normalizzaTelefono(req.body.telefono);

    await client.query('BEGIN');

    const { rows: esistente } = await client.query(
      `SELECT id FROM clienti WHERE telefono = $1 AND stato <> 'cancellato'`, [telefono]
    );
    if (esistente.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ errore: 'Questo numero ha già una tessera: accedi con il codice SMS.', codice: 'GIA_REGISTRATO' });
    }

    const { rows: livelloBase } = await client.query(
      `SELECT id FROM livelli WHERE attivo = true ORDER BY soglia_visite ASC LIMIT 1`
    );
    const { rows: clienteRows } = await client.query(
      `INSERT INTO clienti
        (telefono, telefono_verificato, email, nome, cognome, data_nascita, livello_id,
         consenso_servizio_il, consenso_marketing_il, informativa_versione)
       VALUES ($1, false, $2, $3, $4, $5, $6, now(), $7, $8)
       RETURNING id`,
      [telefono, email || null, nome, cognome || null, dataNascita || null,
       livelloBase[0]?.id || null, consensoMarketing ? new Date() : null, INFORMATIVA_VERSIONE]
    );
    const cliente = clienteRows[0];
    await client.query(
      `INSERT INTO tessere (cliente_id, codice, codice_qr) VALUES ($1, $2, $3)`,
      [cliente.id, `HC-${String(cliente.id).padStart(6, '0')}`, promozioniService.generaCodiceQr()]
    );
    await client.query('COMMIT');
    tgs.clienteCreatoOAggiornato(cliente.id);

    const token = jwtService.creaTokenSessione('cliente', { clienteId: cliente.id });
    res.cookie(jwtService.NOME_COOKIE.cliente, token, opzioniCookie('cliente'));
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ errore: 'Questo numero ha già una tessera: accedi con il codice SMS.', codice: 'GIA_REGISTRATO' });
    next(err);
  } finally {
    client.release();
  }
}

async function logout(req, res) {
  res.clearCookie(jwtService.NOME_COOKIE.cliente, { path: '/' });
  res.json({ ok: true });
}

module.exports = { richiediOtp, verificaOtp, completaProfilo, registra, logout };
