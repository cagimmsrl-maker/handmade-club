// Logica delle promozioni "da caricare", condivisa da cliente, operatore e
// admin. Tutto in SQL parametrizzato; la regola di validità è una sola
// (validaOra) e vale sia per mostrare la promo al cliente sia per
// permetterne l'uso in cassa.

const pool = require('../db/pool');
const crypto = require('crypto');

const TIPI = ['sconto_percentuale', 'prezzo_fisso', 'omaggio', 'messaggio'];

const COLONNE = `
  p.id, p.titolo, p.descrizione, p.tipo, p.valore, p.prodotto,
  p.valido_dal, p.valido_al, p.ora_inizio, p.ora_fine, p.giorni_settimana,
  p.target_livello_id, p.target_sede_id, p.usi_per_cliente,
  p.stato, p.pubblicata_il, p.created_at
`;

// Codice QR statico per una tessera: 12 esadecimali maiuscoli (48 bit).
function generaCodiceQr() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

// La promo è utilizzabile in questo istante (ora locale del server, che è
// quella dei locali) e, se indicata, in questa sede? Non guarda i
// destinatari per livello: quello si decide quando la promo viene
// proposta al cliente (destinatariSql), perché il livello cambia nel tempo
// e una promo caricata resta caricata.
function validaOra(promo, { sedeId = null, adesso = new Date() } = {}) {
  if (promo.stato !== 'pubblicata') return false;
  const oggi = dataLocale(adesso);
  if (oggi < toIso(promo.valido_dal) || oggi > toIso(promo.valido_al)) return false;
  if (promo.giorni_settimana && promo.giorni_settimana.length > 0
      && !promo.giorni_settimana.includes(adesso.getDay())) return false;
  if (promo.ora_inizio && promo.ora_fine) {
    const ora = adesso.toTimeString().slice(0, 5);
    const ini = String(promo.ora_inizio).slice(0, 5);
    const fin = String(promo.ora_fine).slice(0, 5);
    const dentro = ini <= fin ? (ora >= ini && ora <= fin) : (ora >= ini || ora <= fin);
    if (!dentro) return false;
  }
  if (sedeId != null && promo.target_sede_id != null && Number(promo.target_sede_id) !== Number(sedeId)) return false;
  return true;
}

function dataLocale(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const gg = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${gg}`;
}
function toIso(v) {
  return v instanceof Date ? dataLocale(v) : String(v).slice(0, 10);
}

// Promo pubblicate, nel periodo, destinate a questo cliente (per livello),
// con il flag "caricata". Le promo scadute non si mostrano; quelle non
// ancora iniziate sì, così il cliente le può caricare in anticipo.
async function bachecaPerCliente(clienteId) {
  const { rows } = await pool.query(
    `SELECT ${COLONNE},
            s.nome AS sede_nome,
            pc.caricata_il,
            (SELECT count(*) FROM promozioni_utilizzi u
              WHERE u.promozione_id = p.id AND u.cliente_id = $1)::int AS usi
     FROM promozioni p
     JOIN clienti c ON c.id = $1
     LEFT JOIN sedi s ON s.id = p.target_sede_id
     LEFT JOIN promozioni_clienti pc ON pc.promozione_id = p.id AND pc.cliente_id = $1
     WHERE p.stato = 'pubblicata'
       AND p.valido_al >= CURRENT_DATE
       AND (p.target_livello_id IS NULL OR p.target_livello_id = c.livello_id OR pc.id IS NOT NULL)
     ORDER BY pc.caricata_il DESC NULLS LAST, p.valido_dal, p.id`,
    [clienteId]
  );
  return rows.map(serializza);
}

async function carica(clienteId, promozioneId) {
  const { rows } = await pool.query(
    `SELECT ${COLONNE} FROM promozioni p
     JOIN clienti c ON c.id = $1
     WHERE p.id = $2 AND p.stato = 'pubblicata' AND p.valido_al >= CURRENT_DATE
       AND (p.target_livello_id IS NULL OR p.target_livello_id = c.livello_id)`,
    [clienteId, promozioneId]
  );
  if (rows.length === 0) return { ok: false, errore: 'Promozione non disponibile.' };
  await pool.query(
    `INSERT INTO promozioni_clienti (promozione_id, cliente_id) VALUES ($1, $2)
     ON CONFLICT (promozione_id, cliente_id) DO NOTHING`,
    [promozioneId, clienteId]
  );
  return { ok: true };
}

// Promo caricate dal cliente, utilizzabili ORA in questa sede e con usi
// residui: è quello che vede l'operatore dopo la scansione.
async function caricateUtilizzabili(clienteId, sedeId) {
  const { rows } = await pool.query(
    `SELECT ${COLONNE},
            (SELECT count(*) FROM promozioni_utilizzi u
              WHERE u.promozione_id = p.id AND u.cliente_id = $1)::int AS usi
     FROM promozioni_clienti pc
     JOIN promozioni p ON p.id = pc.promozione_id
     WHERE pc.cliente_id = $1 AND p.stato = 'pubblicata'
       AND p.valido_dal <= CURRENT_DATE AND p.valido_al >= CURRENT_DATE
     ORDER BY p.valido_al, p.id`,
    [clienteId]
  );
  return rows
    .filter(p => validaOra(p, { sedeId }))
    .filter(p => p.usi_per_cliente == null || p.usi < p.usi_per_cliente)
    .map(serializza);
}

// L'operatore segna la promo come usata per questo cliente in questa sede.
// Ricontrolla tutto lato server: caricata, valida ora, usi residui.
async function segnaUsata({ clienteId, sedeId, promozioneId }) {
  const utilizzabili = await caricateUtilizzabili(clienteId, sedeId);
  const promo = utilizzabili.find(p => p.id === Number(promozioneId));
  if (!promo) return { ok: false, errore: 'Promozione non utilizzabile ora per questo cliente.' };
  await pool.query(
    `INSERT INTO promozioni_utilizzi (promozione_id, cliente_id, sede_id) VALUES ($1, $2, $3)`,
    [promozioneId, clienteId, sedeId]
  );
  const usiRimasti = promo.usiPerCliente == null ? null : promo.usiPerCliente - promo.usi - 1;
  return { ok: true, usiRimasti };
}

// ---- Admin ----
async function listaAdmin() {
  const { rows } = await pool.query(
    `SELECT ${COLONNE},
            l.nome AS livello_nome, s.nome AS sede_nome,
            (SELECT count(*) FROM promozioni_clienti pc WHERE pc.promozione_id = p.id)::int AS caricamenti,
            (SELECT count(*) FROM promozioni_utilizzi u WHERE u.promozione_id = p.id)::int AS utilizzi
     FROM promozioni p
     LEFT JOIN livelli l ON l.id = p.target_livello_id
     LEFT JOIN sedi s ON s.id = p.target_sede_id
     ORDER BY (p.stato = 'archiviata'), p.valido_dal DESC, p.id DESC`
  );
  return rows.map(serializza);
}

function daBody(b) {
  return [
    b.titolo, b.descrizione || null, b.tipo,
    b.valore ?? null, b.prodotto || null,
    b.validoDal, b.validoAl,
    b.oraInizio || null, b.oraFine || null,
    b.giorniSettimana && b.giorniSettimana.length ? b.giorniSettimana : null,
    b.targetLivelloId ?? null, b.targetSedeId ?? null,
    b.usiPerCliente === null ? null : (b.usiPerCliente ?? 1),
  ];
}

async function creaAdmin(body, adminId) {
  const { rows } = await pool.query(
    `INSERT INTO promozioni (titolo, descrizione, tipo, valore, prodotto, valido_dal, valido_al,
       ora_inizio, ora_fine, giorni_settimana, target_livello_id, target_sede_id, usi_per_cliente, creata_da)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [...daBody(body), adminId]
  );
  return rows[0].id;
}

async function aggiornaAdmin(id, body) {
  const { rowCount } = await pool.query(
    `UPDATE promozioni SET titolo=$1, descrizione=$2, tipo=$3, valore=$4, prodotto=$5,
       valido_dal=$6, valido_al=$7, ora_inizio=$8, ora_fine=$9, giorni_settimana=$10,
       target_livello_id=$11, target_sede_id=$12, usi_per_cliente=$13, updated_at=now()
     WHERE id=$14 AND stato <> 'archiviata'`,
    [...daBody(body), id]
  );
  return rowCount > 0;
}

async function cambiaStato(id, stato) {
  const { rowCount } = await pool.query(
    `UPDATE promozioni
        SET stato = $2,
            pubblicata_il = CASE WHEN $2 = 'pubblicata' AND pubblicata_il IS NULL THEN now() ELSE pubblicata_il END,
            updated_at = now()
      WHERE id = $1`,
    [id, stato]
  );
  return rowCount > 0;
}

async function eliminaAdmin(id) {
  // Si elimina solo una bozza mai pubblicata; il resto si archivia, per
  // non perdere la storia di caricamenti e utilizzi.
  const { rowCount } = await pool.query(
    `DELETE FROM promozioni WHERE id = $1 AND stato = 'bozza' AND pubblicata_il IS NULL`, [id]
  );
  return rowCount > 0;
}

function serializza(r) {
  return {
    id: r.id,
    titolo: r.titolo,
    descrizione: r.descrizione,
    tipo: r.tipo,
    valore: r.valore == null ? null : Number(r.valore),
    prodotto: r.prodotto,
    validoDal: toIso(r.valido_dal),
    validoAl: toIso(r.valido_al),
    oraInizio: r.ora_inizio ? String(r.ora_inizio).slice(0, 5) : null,
    oraFine: r.ora_fine ? String(r.ora_fine).slice(0, 5) : null,
    giorniSettimana: r.giorni_settimana ?? null,
    targetLivelloId: r.target_livello_id,
    targetSedeId: r.target_sede_id,
    livelloNome: r.livello_nome ?? null,
    sedeNome: r.sede_nome ?? null,
    usiPerCliente: r.usi_per_cliente,
    stato: r.stato,
    pubblicataIl: r.pubblicata_il,
    caricataIl: r.caricata_il ?? null,
    caricata: r.caricata_il != null,
    usi: r.usi ?? 0,
    caricamenti: r.caricamenti,
    utilizzi: r.utilizzi,
  };
}

module.exports = {
  TIPI, generaCodiceQr, validaOra,
  bachecaPerCliente, carica, caricateUtilizzabili, segnaUsata,
  listaAdmin, creaAdmin, aggiornaAdmin, cambiaStato, eliminaAdmin,
};
