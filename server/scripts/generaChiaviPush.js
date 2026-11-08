// Genera la coppia di chiavi VAPID per le notifiche push (una volta sola).
// Le chiavi vanno nel .env di produzione (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
// e poi `pm2 restart handmade-club --update-env`. La privata non va mai nel
// repo né nei log: questo script la stampa UNA volta a chi lo lancia.
// Cambiare chiavi dopo = tutte le iscrizioni esistenti smettono di funzionare.
const webpush = require('web-push');
const chiavi = webpush.generateVAPIDKeys();
console.log('Aggiungi al .env:');
console.log(`VAPID_PUBLIC_KEY=${chiavi.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${chiavi.privateKey}`);
console.log('VAPID_SUBJECT=mailto:privacy@handmadecafe.it');
