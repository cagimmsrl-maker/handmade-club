const crypto = require('crypto');
const pool = require('../db/pool');
const otpService = require('../services/otpService');
const jwtService = require('../services/jwtService');
const promozioniService = require('../services/promozioniService');
const { INFORMATIVA_VERSIONE } = require('../config/privacy');
const tgs = require('../services/tgs');
const { opzioniCookie } = require('../services/cookieOptions');

// Crea la tessera con un codice EAN-13 casuale; se per caso il codice esiste
// già (UNIQUE), ne prova un altro. Usa un SAVEPOINT per non far saltare la
// transazione della registrazione.
async function inserisciTessera(client, clienteId, codiceTessera) {
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    await client.query('SAVEPOINT tessera');
    try {
      await client.query(
        `INSERT INTO tessere (cliente_id, codice, codice_qr) VALUES ($1, $2, $3)`,
        [clienteId, codiceTessera, promozioniService.generaCodiceQr()]
      );
      await client.query('RELEASE SAVEPOINT tessera');
      return;
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT tessera');
      if (err.code !== '23505' || !/codice_qr/.test(err.constraint || err.detail || '')) throw err;
    }
  }
  throw new Error('Impossibile generare un codice tessera univoco.');
}

function normalizzaTelefono(telefono) {
  return telefono.trim().replace(/[\s-]/g, '');
}

// Il numero come è salvato sulla tessera. Chi si è registrato con
// "3331234567" e rientra scrivendo "+39 333 1234567" (o il contrario) deve
// ritrovare la sua tessera: si confrontano le ultime 10 cifre e, se c'è un
// solo cliente, si usa il suo numero così com'è salvato. Vale per il codice
// SMS e per il codice dato dal banco (19/11/2026).
async function telefonoCanonico(telefono) {
  const cifre = telefono.replace(/\D/g, '');
  if (cifre.length < 9) return telefono;
  const { rows } = await pool.query(
    `SELECT telefono FROM clienti
     WHERE stato != 'cancellato' AND right(regexp_replace(telefono, '\\D', '', 'g'), 10) = $1
     LIMIT 2`,
    [cifre.slice(-10)]
  );
  return rows.length === 1 ? rows[0].telefono : telefono;
}

async function richiediOtp(req, res, next) {
  try {
    const telefono = await telefonoCanonico(normalizzaTelefono(req.body.telefono));
    await otpService.richiediOtp(telefono);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Codice di rinnovo unico (20/11/2026, deciso dal titolare per rimediare alle
// tessere scadute dopo 30 giorni): un solo codice numerico, uguale per tutti,
// detto al banco. Sta nel .env (CODICE_RINNOVO, 6 cifre; vuoto = spento) con
// scadenza facoltativa CODICE_RINNOVO_FINO_AL (AAAA-MM-GG, compreso).
// Non dimostra che chi entra sia il titolare del numero: perciò NON segna il
// numero come verificato e NON chiude le altre sessioni (sessioni_valide_da).
// Rischio accettato dal titolare: chi sa codice e numero entra in quella tessera.
// Freno: al massimo 3 rientri al giorno per numero (in memoria) + limite per IP.
const MAX_RINNOVI_GIORNO = 3;
const rinnoviPerNumero = new Map();
function codiceRinnovoAttivo() {
  const codice = (process.env.CODICE_RINNOVO || '').trim();
  if (!/^\d{6}$/.test(codice)) return null;
  const finoAl = (process.env.CODICE_RINNOVO_FINO_AL || '').trim();
  if (finoAl) {
    const fine = new Date(`${finoAl}T23:59:59`);
    if (Number.isNaN(fine.getTime()) || Date.now() > fine.getTime()) return null;
  }
  return codice;
}
function stessoCodice(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
async function entraConCodiceRinnovo(telefono, codice, res) {
  const atteso = codiceRinnovoAttivo();
  if (!atteso || !stessoCodice(codice, atteso)) return false;
  const { rows } = await pool.query(
    `SELECT c.id FROM clienti c JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
      WHERE c.telefono = $1 AND c.stato = 'attivo'`,
    [telefono]
  );
  if (rows.length !== 1) return false;
  const oggi = new Date().toDateString();
  const v = rinnoviPerNumero.get(telefono);
  const n = v && v.giorno === oggi ? v.n : 0;
  if (n >= MAX_RINNOVI_GIORNO) {
    throw new otpService.ErroreApplicativo(429, 'Troppi accessi per questo numero oggi. Chiedi alla cassa.');
  }
  if (rinnoviPerNumero.size > 5000) rinnoviPerNumero.clear();
  rinnoviPerNumero.set(telefono, { giorno: oggi, n: n + 1 });
  const token = jwtService.creaTokenSessione('cliente', { clienteId: rows[0].id });
  res.cookie(jwtService.NOME_COOKIE.cliente, token, opzioniCookie('cliente'));
  console.log(`[rinnovo] rientro con codice di rinnovo, cliente ${rows[0].id}`);
  res.json({ ok: true, nuovoCliente: false });
  return true;
}

async function verificaOtp(req, res, next) {
  try {
    const telefono = await telefonoCanonico(normalizzaTelefono(req.body.telefono));
    if (await entraConCodiceRinnovo(telefono, req.body.codice, res)) return;
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
    await inserisciTessera(client, cliente.id, codiceTessera);

    await client.query('COMMIT');
    tgs.clienteCreatoOAggiornato(cliente.id);
    promozioniService.caricaAutomaticheNuovoCliente(cliente.id).catch((e) => console.error(`[promo] automatiche per cliente ${cliente.id}: ${e.message}`));

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
    const origine = req.body.origine || null;
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
         consenso_servizio_il, consenso_marketing_il, informativa_versione, origine)
       VALUES ($1, false, $2, $3, $4, $5, $6, now(), $7, $8, $9)
       RETURNING id`,
      [telefono, email || null, nome, cognome || null, dataNascita || null,
       livelloBase[0]?.id || null, consensoMarketing ? new Date() : null, INFORMATIVA_VERSIONE, origine]
    );
    const cliente = clienteRows[0];
    await inserisciTessera(client, cliente.id, `HC-${String(cliente.id).padStart(6, '0')}`);
    await client.query('COMMIT');
    tgs.clienteCreatoOAggiornato(cliente.id);
    promozioniService.caricaAutomaticheNuovoCliente(cliente.id).catch((e) => console.error(`[promo] automatiche per cliente ${cliente.id}: ${e.message}`));

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

// GET /auth/offerta — testo dell'offerta di benvenuto mostrato PRIMA della
// registrazione (pagina /installa e modulo "Crea la tua tessera"), così chi
// arriva da una pubblicità sa cosa ottiene. Dal .env, senza deploy:
// OFFERTA_BENVENUTO_TITOLO / OFFERTA_BENVENUTO_TESTO; vuoti = niente riquadro.
function offerta(req, res) {
  const titolo = (process.env.OFFERTA_BENVENUTO_TITOLO || '').trim();
  const testo = (process.env.OFFERTA_BENVENUTO_TESTO || '').trim();
  res.set('Cache-Control', 'public, max-age=300');
  res.json(titolo || testo ? { titolo, testo } : null);
}

async function logout(req, res) {
  res.clearCookie(jwtService.NOME_COOKIE.cliente, { path: '/' });
  res.json({ ok: true });
}

module.exports = { richiediOtp, verificaOtp, completaProfilo, registra, logout, offerta };
