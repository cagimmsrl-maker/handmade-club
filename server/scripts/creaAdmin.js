#!/usr/bin/env node
// Script CLI per creare il primo utente admin (o utenti successivi).
// Uso: npm run crea-admin  (chiede username, nome, password interattivamente)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const readline = require('readline');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');

const CODICE_INVIO = [10, 13]; // \n, \r
const CODICE_CTRL_C = 3;
const CODICE_BACKSPACE = [8, 127]; // backspace / DEL

function chiedi(rl, domanda) {
  return new Promise((resolve) => rl.question(domanda, resolve));
}

function chiediNascosta(domanda) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(domanda);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let input = '';
    const onData = (char) => {
      const codice = char.charCodeAt(0);
      if (CODICE_INVIO.includes(codice)) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
        return;
      }
      if (codice === CODICE_CTRL_C) process.exit(1);
      if (CODICE_BACKSPACE.includes(codice)) {
        input = input.slice(0, -1);
        return;
      }
      input += char;
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const username = (await chiedi(rl, 'Username admin: ')).trim();
  const nome = (await chiedi(rl, 'Nome e cognome: ')).trim();
  rl.close();
  const password = await chiediNascosta('Password: ');

  if (!username || !nome || password.length < 8) {
    console.error('Username, nome obbligatori e password di almeno 8 caratteri.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      `INSERT INTO admin_users (username, password_hash, nome) VALUES ($1, $2, $3)`,
      [username, hash, nome]
    );
    console.log(`Admin "${username}" creato correttamente.`);
  } catch (err) {
    if (err.code === '23505') {
      console.error(`Esiste già un admin con username "${username}".`);
    } else {
      console.error('Errore durante la creazione:', err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
