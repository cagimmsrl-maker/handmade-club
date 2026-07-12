const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const smsService = require('./smsService');

const MAX_TENTATIVI = 3;
const VALIDITA_MINUTI = 5;
const MAX_RICHIESTE_PER_NUMERO = 5;
const FINESTRA_RICHIESTE_MINUTI = 15;

class ErroreApplicativo extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function generaCodice() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function richiediOtp(telefono) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM otp_codes
     WHERE telefono = $1 AND created_at > now() - interval '${FINESTRA_RICHIESTE_MINUTI} minutes'`,
    [telefono]
  );
  if (rows[0].n >= MAX_RICHIESTE_PER_NUMERO) {
    throw new ErroreApplicativo(429, 'Troppe richieste per questo numero. Riprova più tardi.');
  }

  const codice = generaCodice();
  const codiceHash = await bcrypt.hash(codice, 10);

  await pool.query(
    `INSERT INTO otp_codes (telefono, codice_hash, scade_il)
     VALUES ($1, $2, now() + interval '${VALIDITA_MINUTI} minutes')`,
    [telefono, codiceHash]
  );

  await smsService.inviaOtp(telefono, codice);
}

async function verificaOtp(telefono, codice) {
  const { rows } = await pool.query(
    `SELECT id, codice_hash, scade_il, tentativi, usato FROM otp_codes
     WHERE telefono = $1 ORDER BY created_at DESC LIMIT 1`,
    [telefono]
  );
  const otp = rows[0];
  if (!otp || otp.usato) {
    throw new ErroreApplicativo(400, 'Richiedi un nuovo codice.');
  }
  if (new Date(otp.scade_il) < new Date()) {
    throw new ErroreApplicativo(400, 'Codice scaduto. Richiedi un nuovo codice.');
  }
  if (otp.tentativi >= MAX_TENTATIVI) {
    throw new ErroreApplicativo(429, 'Numero massimo di tentativi raggiunto. Richiedi un nuovo codice.');
  }

  const valido = await bcrypt.compare(codice, otp.codice_hash);
  if (!valido) {
    await pool.query('UPDATE otp_codes SET tentativi = tentativi + 1 WHERE id = $1', [otp.id]);
    const tentativiRimasti = MAX_TENTATIVI - (otp.tentativi + 1);
    throw new ErroreApplicativo(400, `Codice errato. Tentativi rimasti: ${Math.max(tentativiRimasti, 0)}.`);
  }

  await pool.query('UPDATE otp_codes SET usato = true WHERE id = $1', [otp.id]);
}

module.exports = { richiediOtp, verificaOtp, ErroreApplicativo };
