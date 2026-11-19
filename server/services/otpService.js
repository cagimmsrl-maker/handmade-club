const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const smsService = require('./smsService');

const MAX_TENTATIVI = 3;
const VALIDITA_MINUTI = 5;
const MAX_RICHIESTE_PER_NUMERO = 5;
const FINESTRA_RICHIESTE_MINUTI = 15;
// Tra due richieste per lo stesso numero devono passare almeno 60 s: chi non
// riceve l'SMS tende a premere "rinvia" a raffica (31/10/2026: fino a 5 volte
// in un minuto), e ogni pressione costa un SMS senza cambiare nulla.
const INTERVALLO_MINIMO_SECONDI = 60;

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
  const recente = await pool.query(
    `SELECT 1 FROM otp_codes
     WHERE telefono = $1 AND created_at > now() - interval '${INTERVALLO_MINIMO_SECONDI} seconds'
     LIMIT 1`,
    [telefono]
  );
  if (recente.rows.length > 0) {
    throw new ErroreApplicativo(429, 'Attendi un minuto prima di richiedere un altro codice.');
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

// Vale QUALSIASI codice non usato e non scaduto di quel numero (gli ultimi 5),
// non solo l'ultimo creato (19/11/2026): così il codice dato dalla cassa o
// dall'admin resta buono anche se il cliente, prima o dopo, preme "Invia
// codice" nell'app e ne nasce un altro via SMS. Il freno ai tentativi resta
// sull'ultimo codice creato; al primo codice giusto si bruciano tutti.
async function verificaOtp(telefono, codice) {
  const { rows } = await pool.query(
    `SELECT id, codice_hash, scade_il, tentativi, usato FROM otp_codes
     WHERE telefono = $1 ORDER BY created_at DESC LIMIT 5`,
    [telefono]
  );
  const ultimo = rows[0];
  const validi = rows.filter((r) => !r.usato && new Date(r.scade_il) >= new Date());
  if (!ultimo || validi.length === 0) {
    const scaduto = ultimo && !ultimo.usato;
    throw new ErroreApplicativo(400, scaduto ? 'Codice scaduto. Richiedi un nuovo codice.' : 'Codice non valido. Controlla il codice o chiedilo alla cassa.');
  }
  if (ultimo.tentativi >= MAX_TENTATIVI) {
    throw new ErroreApplicativo(429, 'Numero massimo di tentativi raggiunto. Richiedi un nuovo codice.');
  }

  let trovato = false;
  for (const r of validi) {
    if (await bcrypt.compare(codice, r.codice_hash)) { trovato = true; break; }
  }
  if (!trovato) {
    await pool.query('UPDATE otp_codes SET tentativi = tentativi + 1 WHERE id = $1', [ultimo.id]);
    const tentativiRimasti = MAX_TENTATIVI - (ultimo.tentativi + 1);
    throw new ErroreApplicativo(400, `Codice errato. Tentativi rimasti: ${Math.max(tentativiRimasti, 0)}.`);
  }

  await pool.query('UPDATE otp_codes SET usato = true WHERE id = ANY($1::int[])', [validi.map((r) => r.id)]);
}

// Codice di accesso generato dall'admin (19/11/2026), per quando l'SMS non
// arriva (Skebby non consegna verso alcuni operatori). Stessa tabella e stessa
// verifica dei codici SMS; resta valido anche se il cliente chiede un altro
// codice dall'app (vedi verificaOtp). Validità più lunga perché passa a voce
// o per WhatsApp. Il codice non viene mai salvato in chiaro.
const VALIDITA_ADMIN_MINUTI = 30;
async function codiceDaAdmin(telefono) {
  const codice = generaCodice();
  const codiceHash = await bcrypt.hash(codice, 10);
  await pool.query(
    `INSERT INTO otp_codes (telefono, codice_hash, scade_il)
     VALUES ($1, $2, now() + interval '${VALIDITA_ADMIN_MINUTI} minutes')`,
    [telefono, codiceHash]
  );
  return { codice, validoMinuti: VALIDITA_ADMIN_MINUTI };
}

module.exports = { richiediOtp, verificaOtp, codiceDaAdmin, ErroreApplicativo };
