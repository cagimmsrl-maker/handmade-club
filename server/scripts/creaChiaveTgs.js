#!/usr/bin/env node
// Genera la chiave X-Api-Key per il servizio TGS di un punto vendita.
// Uso: npm run crea-chiave-tgs  (chiede la sede). La chiave si vede UNA
// volta sola qui: nel DB resta solo l'hash. Da comunicare a TGS per un
// canale sicuro, mai in chat o in chiaro per email se evitabile.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const readline = require('readline');
const pool = require('../db/pool');
const { hashChiave } = require('../middleware/authTgs');

async function main() {
  const { rows: sedi } = await pool.query('SELECT id, nome FROM sedi WHERE attiva = true ORDER BY id');
  if (sedi.length === 0) { console.error('Nessuna sede attiva: creala prima da /admin.'); process.exit(1); }
  console.log('Sedi attive:'); sedi.forEach((s) => console.log(`  ${s.id}) ${s.nome}`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const risposta = await new Promise((r) => rl.question('Id della sede per cui creare la chiave: ', r));
  rl.close();
  const sede = sedi.find((s) => String(s.id) === risposta.trim());
  if (!sede) { console.error('Sede non valida.'); process.exit(1); }

  const chiave = 'hc_' + crypto.randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO tgs_chiavi_api (sede_id, etichetta, chiave_hash) VALUES ($1, $2, $3)`,
    [sede.id, `TGS ${sede.nome}`, hashChiave(chiave)]
  );
  console.log(`\nChiave creata per la sede "${sede.nome}". Copiala ADESSO, non sarà più visibile:\n`);
  console.log(`  X-Api-Key: ${chiave}\n`);
  console.log('Endpoint per TGS:');
  console.log('  GET  https://club.handmadecafe.it/api/tgs/clienti-da-sincronizzare');
  console.log('  POST https://club.handmadecafe.it/api/tgs/clienti/{id}/esito');
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
