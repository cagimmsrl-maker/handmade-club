// Servizio invio SMS isolato dal resto dell'app: oggi solo il provider
// "console" (log, per i test in Tappa 1). Skebby/Twilio si aggiungono
// come nuovi provider senza toccare i chiamanti.

const providers = {
  console: {
    async inviaOtp(telefono, codice) {
      console.log(`[SMS a ${telefono}] Il tuo codice Handmade Club è: ${codice} (valido 5 minuti)`);
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

module.exports = { inviaOtp };
