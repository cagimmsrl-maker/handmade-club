// Foto caricate dall'admin (oggi: promozioni). I file stanno su disco in
// UPLOADS_DIR (default: <repo>/uploads, ignorata da git, quindi sopravvive
// ai deploy), serviti da Express sotto /uploads. Regole:
//  - il tipo si riconosce dal contenuto (magic bytes), non dall'estensione
//    o dal Content-Type dichiarato dal browser;
//  - il nome del file lo genera il server (casuale): niente path traversal,
//    niente nomi indovinabili, e il browser può cacharlo per sempre perché
//    una foto nuova ha sempre un nome nuovo;
//  - il limite di peso è sotto 1 MB perché Nginx, con la sua configurazione
//    di default (client_max_body_size 1m), rifiuterebbe richieste più
//    grandi prima che arrivino qui; il client ridimensiona la foto prima di
//    inviarla (client/src/lib/immagini.js).

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const DIR_PROMOZIONI = path.join(UPLOADS_DIR, 'promozioni');
const MAX_BYTE = 950 * 1024;
const NOME_VALIDO = /^[a-f0-9]{24}\.(jpg|png|webp)$/;

function tipoDaContenuto(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

async function assicuraCartelle() {
  await fs.mkdir(DIR_PROMOZIONI, { recursive: true });
}

// Salva il buffer e restituisce il nome del file (da mettere nel DB).
// Lancia un errore con status 400 se il contenuto non è un'immagine
// accettata, 413 se troppo pesante.
async function salvaImmaginePromozione(buf) {
  if (!buf || buf.length === 0) {
    const e = new Error('Nessuna immagine ricevuta.'); e.status = 400; throw e;
  }
  if (buf.length > MAX_BYTE) {
    const e = new Error('Immagine troppo pesante (massimo 950 KB).'); e.status = 413; throw e;
  }
  const tipo = tipoDaContenuto(buf);
  if (!tipo) {
    const e = new Error('Formato non riconosciuto: servono JPG, PNG o WebP.'); e.status = 400; throw e;
  }
  await assicuraCartelle();
  const nome = `${crypto.randomBytes(12).toString('hex')}.${tipo}`;
  await fs.writeFile(path.join(DIR_PROMOZIONI, nome), buf, { flag: 'wx' });
  return nome;
}

// Cancella un file di promozione, se esiste. Non è un errore se manca.
async function eliminaImmaginePromozione(nome) {
  if (!nome || !NOME_VALIDO.test(nome)) return;
  try {
    await fs.unlink(path.join(DIR_PROMOZIONI, nome));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`[immagini] impossibile cancellare ${nome}: ${err.message}`);
  }
}

function urlImmaginePromozione(nome) {
  return nome && NOME_VALIDO.test(nome) ? `/uploads/promozioni/${nome}` : null;
}

module.exports = {
  UPLOADS_DIR, MAX_BYTE,
  assicuraCartelle, salvaImmaginePromozione, eliminaImmaginePromozione, urlImmaginePromozione,
};
