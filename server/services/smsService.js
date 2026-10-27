// Servizio invio SMS isolato dal resto dell'app. Il provider si sceglie con
// SMS_PROVIDER nel .env:
//   console  → logga soltanto (sviluppo / finché non c'è un provider vero).
//              ATTENZIONE: in produzione il cliente NON riceve nulla.
//   skebby   → API REST Skebby (https://developers.skebby.it). Variabili:
//              SKEBBY_USER, SKEBBY_PASSWORD, SKEBBY_SENDER (alias mittente
//              registrato, max 11 caratteri, es. "HandmadeCl"),
//              SKEBBY_MESSAGE_TYPE (GP = Classic+ con mittente personalizzato,
//              TI = Classic, SI = Basic; default GP).
// Gli errori del provider non devono far cadere il server: si loggano senza
// il numero completo e si rilancia un errore generico al chiamante.

const SKEBBY_BASE = 'https://api.skebby.it/API/v1.0/REST';

// Skebby vuole il numero in formato internazionale senza '+' (39335…).
// I clienti spesso si registrano senza +39: qui si normalizza SOLO per
// l'invio, senza toccare il numero salvato. Stessa logica di tgsController.
function numeroPerSkebby(telefono) {
  let s = String(telefono || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (!s.startsWith('+')) {
    if (s.startsWith('00')) s = '+' + s.slice(2);
    else if (/^39\d{9,10}$/.test(s)) s = '+' + s;
    else if (/^3\d{8,9}$/.test(s)) s = '+39' + s;
    else if (/^0\d{5,10}$/.test(s)) s = '+39' + s;
  }
  return s.replace(/^\+/, '');
}

function mascheraNumero(telefono) {
  const t = String(telefono);
  return t.length > 4 ? `${t.slice(0, 3)}…${t.slice(-3)}` : '***';
}

function testoOtp(codice) {
  return `Il tuo codice Handmade Club è ${codice}. Vale 5 minuti. Se non l'hai richiesto, ignora questo messaggio.`;
}

const providers = {
  console: {
    async inviaOtp(telefono, codice) {
      console.log(`[SMS console a ${mascheraNumero(telefono)}] ${testoOtp(codice)}`);
      // Solo per sviluppo: il codice in chiaro serve a chi fa i test senza SMS.
      if (process.env.NODE_ENV !== 'production') console.log(`[SMS console] codice OTP: ${codice}`);
      else console.log(`[SMS console] OTP per ${mascheraNumero(telefono)}: ${codice} (provider console in produzione: configurare SMS_PROVIDER=skebby)`);
    },
  },

  skebby: {
    sessione: null,

    async login() {
      const user = process.env.SKEBBY_USER;
      const password = process.env.SKEBBY_PASSWORD;
      if (!user || !password) throw new Error('SKEBBY_USER / SKEBBY_PASSWORD mancanti');
      const url = `${SKEBBY_BASE}/login?username=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`login Skebby fallito: HTTP ${r.status}`);
      const [userKey, sessionKey] = (await r.text()).trim().split(';');
      if (!userKey || !sessionKey) throw new Error('login Skebby: risposta inattesa');
      this.sessione = { userKey, sessionKey, creataIl: Date.now() };
      return this.sessione;
    },

    async sessioneValida() {
      // La session key Skebby dura alcune ore: la rinnoviamo ogni 60 minuti.
      if (!this.sessione || Date.now() - this.sessione.creataIl > 60 * 60 * 1000) await this.login();
      return this.sessione;
    },

    async invia(telefono, testo, riprova = true) {
      const { userKey, sessionKey } = await this.sessioneValida();
      const corpo = {
        message_type: process.env.SKEBBY_MESSAGE_TYPE || 'GP',
        message: testo,
        recipient: [numeroPerSkebby(telefono)],
        sender: process.env.SKEBBY_SENDER || undefined,
        returnCredits: false,
      };
      const r = await fetch(`${SKEBBY_BASE}/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', user_key: userKey, Session_key: sessionKey },
        body: JSON.stringify(corpo),
      });
      if (r.status === 401 && riprova) {
        this.sessione = null;
        return this.invia(telefono, testo, false);
      }
      const dati = await r.json().catch(() => ({}));
      if (!r.ok || dati.result !== 'OK') {
        throw new Error(`invio Skebby fallito: HTTP ${r.status} ${dati.result || ''}`);
      }
      return dati;
    },

    async inviaOtp(telefono, codice) {
      try {
        await this.invia(telefono, testoOtp(codice));
        console.log(`[SMS skebby] OTP inviato a ${mascheraNumero(telefono)}`);
      } catch (err) {
        console.error(`[SMS skebby] errore invio a ${mascheraNumero(telefono)}: ${err.message}`);
        const e = new Error('Invio SMS non riuscito. Riprova tra qualche minuto.');
        e.status = 502;
        throw e;
      }
    },
  },
};

function getProvider() {
  const nome = process.env.SMS_PROVIDER || 'console';
  const provider = providers[nome];
  if (!provider) {
    throw new Error(`Provider SMS non configurato: ${nome}`);
  }
  return provider;
}

async function inviaOtp(telefono, codice) {
  await getProvider().inviaOtp(telefono, codice);
}

module.exports = { inviaOtp, numeroPerSkebby };
