// Client HTTP minimo verso il WebService TGS: login → token JWT, chiamate
// con Bearer, ri-login automatico su 401, timeout corto. Non conosce il
// dominio (clienti, promo): quello sta in fidelity.js.
//
// TLS: il WebService esporrà quasi certamente un certificato autofirmato.
// Non si disattiva la verifica (aprirebbe a chi si mette in mezzo): si
// "appunta" l'impronta SHA-256 del certificato (TGS_CERT_FINGERPRINT) e si
// accetta solo quello. Senza impronta vale la verifica standard. Per questo
// si usa https.request e non fetch: fetch non permette il controllo del
// certificato.

const https = require('https');
const http = require('http');
const config = require('./config');

const DURATA_TOKEN_MS = 50 * 60 * 1000; // rinnovo prudente, prima della scadenza

class ErroreTgs extends Error {
  constructor(messaggio, { status = null, corpo = null, ritentabile = true } = {}) {
    super(messaggio);
    this.status = status;
    this.corpo = corpo;
    this.ritentabile = ritentabile; // false = inutile riprovare uguale (dati rifiutati)
  }
}

let token = null; // { valore, ottenutoIl }
let agenti = {};  // per baseUrl+impronta

function normalizzaImpronta(s) {
  return String(s || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

function agente(c) {
  const chiave = `${c.baseUrl}|${c.impronta}`;
  if (agenti[chiave]) return agenti[chiave];
  const attesa = normalizzaImpronta(c.impronta);
  agenti[chiave] = new https.Agent({
    keepAlive: true,
    rejectUnauthorized: !attesa,
    checkServerIdentity: attesa
      ? (host, cert) => {
          const impronta = normalizzaImpronta(cert.fingerprint256);
          return impronta === attesa ? undefined : new Error(`certificato TGS non riconosciuto (${impronta})`);
        }
      : undefined,
  });
  return agenti[chiave];
}

function richiestaGrezza(metodo, url, { headers, corpo, timeoutMs, c }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const sicuro = u.protocol === 'https:';
    const modulo = sicuro ? https : http;
    const dati = corpo !== undefined ? Buffer.from(JSON.stringify(corpo)) : null;
    const req = modulo.request(
      u,
      {
        method: metodo,
        headers: { ...headers, ...(dati ? { 'Content-Length': dati.length } : {}) },
        agent: sicuro ? agente(c) : undefined,
        timeout: timeoutMs,
      },
      (res) => {
        const pezzi = [];
        res.on('data', (d) => pezzi.push(d));
        res.on('end', () => resolve({ status: res.statusCode, testo: Buffer.concat(pezzi).toString('utf8') }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (dati) req.write(dati);
    req.end();
  });
}

async function richiesta(metodo, percorso, { corpo, conToken = true, c = config.leggi() } = {}) {
  const url = `${c.baseUrl}${percorso.startsWith('/') ? '' : '/'}${percorso}`;
  const headers = { Accept: 'application/json' };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (conToken) headers.Authorization = `Bearer ${await tokenValido(c)}`;

  let r;
  try {
    r = await richiestaGrezza(metodo, url, { headers, corpo, timeoutMs: c.timeoutMs, c });
  } catch (err) {
    throw new ErroreTgs(`TGS non raggiungibile: ${err.message}`);
  }
  let dati = null;
  try { dati = r.testo ? JSON.parse(r.testo) : null; } catch { dati = r.testo; }
  if (r.status === 401) {
    token = null; // il prossimo giro rifà il login
    // Al login un 401 = credenziali sbagliate (TGS_USER/TGS_PASSWORD); con il
    // token = scaduto o revocato. Restano ritentabili: sistemata la
    // configurazione, gli eventi in coda ripartono da soli.
    throw new ErroreTgs(conToken ? 'TGS: token rifiutato (401)' : 'TGS: credenziali rifiutate al login (401)', { status: 401, corpo: dati });
  }
  if (r.status < 200 || r.status >= 300) {
    // 4xx = richiesta sbagliata per loro: ritentarla identica non serve.
    throw new ErroreTgs(`TGS HTTP ${r.status}`, { status: r.status, corpo: dati, ritentabile: r.status >= 500 });
  }
  return dati;
}

// Login: ottiene il token. ENDPOINT E FORMATO DA CONFERMARE CON TGS.
// Ipotesi di lavoro (ASP.NET + JwtBearer): POST /api/Login con
// { username, password } → { token } oppure { access_token }.
async function login(c = config.leggi()) {
  const risposta = await richiesta('POST', process.env.TGS_LOGIN_PATH || '/api/Login', {
    corpo: { username: c.utente, password: c.password }, // DA CONFERMARE CON TGS
    conToken: false,
    c,
  });
  const valore =
    risposta?.token || risposta?.access_token || risposta?.Token || risposta?.accessToken ||
    (typeof risposta === 'string' && risposta.length > 20 ? risposta : null);
  if (!valore) throw new ErroreTgs('TGS: login senza token nella risposta', { corpo: risposta, ritentabile: false });
  token = { valore, ottenutoIl: Date.now() };
  return valore;
}

async function tokenValido(c) {
  if (!token || Date.now() - token.ottenutoIl > DURATA_TOKEN_MS) await login(c);
  return token.valore;
}

// Chiamata autenticata, con un solo ri-login automatico se il token è scaduto.
async function chiama(metodo, percorso, corpo) {
  try {
    return await richiesta(metodo, percorso, { corpo });
  } catch (err) {
    if (err.status === 401) return richiesta(metodo, percorso, { corpo });
    throw err;
  }
}

// Verifica di raggiungibilità (check.sh / admin): fa solo il login.
async function prova() {
  const c = config.leggi();
  const mancano = config.valida(c);
  if (mancano.length) return { ok: false, errore: `configurazione incompleta: ${mancano.join(', ')}` };
  try {
    await login(c);
    return { ok: true };
  } catch (err) {
    return { ok: false, errore: err.message, status: err.status ?? null };
  }
}

function azzeraToken() { token = null; agenti = {}; }

module.exports = { chiama, login, prova, azzeraToken, ErroreTgs };
