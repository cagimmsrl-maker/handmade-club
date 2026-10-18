# CLAUDE.md — App Clienti Handmade ("Handmade Club")

## Cos'è questo progetto

App web pubblica (PWA) per i clienti finali dei punti vendita Handmade Café (Car Food S.r.l.).
Funzionalità: registrazione immediata con verifica OTP differita, tessera fedeltà digitale con QR statico,
promozioni da caricare, 
livelli dinamici basati sulle visite, convenzioni aziendali, pannello admin, schermata scansione operatore.

**Questo NON è il gestionale interno.** È un sistema separato: repository separato, database separato,
processo PM2 separato, sottodominio separato. Non toccare mai il database o i file del gestionale ordini.

## Stack

- Frontend: React + Vite (PWA, installabile su home screen, mobile-first)
- Backend: Node.js + Express
- Database: PostgreSQL — database `handmade_clienti`, utente dedicato `hclub` (NON l'utente del gestionale)
- Process manager: PM2, processo `handmade-club` su porta 3002
- Reverse proxy: Nginx su **https://club.handmadecafe.it** (dal 18/10/2026), config
  `/etc/nginx/sites-available/club.handmadecafe.it.conf` → `proxy_pass http://127.0.0.1:3002` con
  `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`. Certificato Let's Encrypt via `certbot --nginx`
  (rinnovo automatico), http → 301 https. Express ha `trust proxy 1`: il rate limiting vede l'IP reale.
  **La porta 3002 resta chiusa all'esterno** (ufw apre solo 22/80/443): si entra solo da nginx.
  Non aprirla e non esporre altre porte. In `server/.env` di produzione `COOKIE_SECURE=true`
  (cookie di sessione `Secure`): il `.env` non è nel repo, si cambia a mano con backup e `pm2 restart --update-env`.
  Le config nginx del sito (`handmadecafe.conf`) e del gestionale (`cagimm`) non vanno toccate.

## Regole di produzione (NON derogabili)

1. **Migrazioni numerate.** Ogni modifica allo schema passa da un file `migrations/NNN_descrizione.sql`
   progressivo. Mai ALTER manuali fuori migrazione. Ogni migrazione registra sé stessa nella tabella
   `schema_migrations`.
2. **Deploy automatico (regola aggiornata 18/10/2026).** Esiste la GitHub Action
   `.github/workflows/deploy.yml`: ogni push su `main` lancia `./scripts/deploy.sh --pull` sul server.
   Quindi il flusso è: **commit → (al "deploy" di Ciro) git push → la Action fa il deploy.**
   Mai fare git push senza il "deploy" esplicito: il push È il deploy in produzione.
   Lo script esegue la sequenza nell'ordine corretto e si ferma al primo errore:
   backup DB → migrazioni pendenti (+ GRANT a `hclub`) → `pm2 restart handmade-club` →
   build frontend in cartella temporanea → scambio atomico di `client/dist` → `check.sh`.
       ./scripts/deploy.sh             # deploy manuale (emergenze / GitHub non raggiungibile)
       ./scripts/deploy.sh --dry-run   # mostra cosa farebbe, non tocca nulla
       ./scripts/check.sh              # solo verifiche, non tocca nulla
       ./scripts/rollback.sh [--db]    # torna alla versione precedente
   Backup e log di deploy in `/root/backups/handmade-club/`. Stato delle Action su
   https://github.com/cagimmsrl-maker/handmade-club/actions.
   **Mai `npm run build` nel repo:** `client/dist` è servita direttamente in produzione, quindi una build
   nel repo pubblica all'istante il frontend. Per verificare che compili, buildare fuori dal repo:
       cd client && npx vite build --outDir /tmp/verifica-build-hclub --emptyOutDir
   Le migrazioni le applica solo deploy.sh (come `postgres` con `SET ROLE hclub`, così gli oggetti
   restano di `hclub`); ogni file `NNN_*.sql` deve avere il suo BEGIN/COMMIT e l'INSERT in
   `schema_migrations (versione, descrizione)` con versione = NNN.
3. **Niente dati fittizi in produzione.** Nessun seed di clienti di prova nel DB di produzione.
   Per i test si usano numeri di telefono reali del titolare/staff.
4. **Questo è un sistema pubblico esposto a Internet.** A differenza del gestionale (trust-based),
   qui la sicurezza è rigorosa:
   - Rate limiting su tutte le rotte pubbliche (login, richiesta OTP: max 5 richieste/15 min per IP e per numero)
   - OTP a 6 cifre, validità 5 minuti, monouso, max 3 tentativi di verifica
   - Sessioni con JWT httpOnly + secure, scadenza 30 giorni (i clienti non devono riloggarsi ogni volta)
   - Input validation su ogni endpoint (mai fidarsi del client)
   - Nessun dato sensibile nei log
5. **Ruoli separati.** Tre superfici distinte:
   - `/` → app cliente (pubblica, registrazione immediata + verifica OTP differita, vedi sotto)
   - `/operatore` → schermata scansione QR (login con PIN sede, pensata per tablet al banco)
   - `/admin` → pannello amministrazione (login con password, solo titolare/manager)
6. **QR statico (dal 18/10/2026, migrazione 003).** Il QR del cliente è `tessere.codice_qr`, un codice
   casuale fisso (12 esadecimali), così le casse lo leggono come un codice a barre e si può stampare.
   Ha sostituito il token JWT rotante: lo screenshot condiviso è un rischio accettato, mitigato dal
   fatto che l'operatore vede nome e livello e che le promo sono legate all'account; con TGS sarà la
   cassa a verificare. `GET /cliente/qr-token` e il campo `qrToken` della scansione restano solo per
   compatibilità con le app già installate e vanno rimossi in una fase successiva. Il codice umano
   `tessere.codice` (HC-000042) non va MAI usato come QR: è sequenziale e indovinabile.
7. **GDPR by design.** Consensi tracciati con timestamp in colonne dedicate. Consenso marketing
   SEPARATO e facoltativo. Endpoint di cancellazione account self-service (soft delete + anonimizzazione).
8. **Lingua.** Tutta l'interfaccia utente in italiano.

## Accesso cliente — "entri subito, verifichi dopo" (migrazione 004, dal 18/10/2026)

- **Registrazione immediata** (`POST /auth/registra`): nome + telefono + consensi → tessera subito,
  sessione aperta, `telefono_verificato = false`. Nessun OTP all'ingresso: al banco l'iscrizione deve
  durare 10 secondi. Se il numero esiste già → 409 `GIA_REGISTRATO` e si manda al login con codice.
- **Verifica differita** (`POST /cliente/verifica/richiedi` + `/conferma`, cliente loggato): l'OTP
  va al numero già registrato. È richiesta per **caricare una promozione** (`carica` risponde 403
  `VERIFICA_RICHIESTA` se non verificato) e lo sarà per le notifiche push. Componente
  `VerificaNumero` nel client, usato da Profilo e bacheca Promo.
- **Login con codice** (`/auth/richiedi-otp` + `/verifica-otp`): per chi ha già la tessera e deve
  rientrare (telefono nuovo, sessione scaduta). Chi supera l'OTP è il titolare del numero: se
  l'account era stato creato senza verifica, `clienti.sessioni_valide_da = now()` e `authCliente`
  rifiuta ogni JWT emesso prima (`iat`). Così chi si fosse registrato con il numero di un altro
  perde l'accesso nel momento in cui il vero titolare verifica. Non rimuovere questo controllo.
- **SMS**: `smsService` ha i provider `console` (solo log: in produzione il cliente NON riceve il
  codice) e `skebby` (API REST, variabili `SKEBBY_*` nel `.env`). Finché `SMS_PROVIDER=console`,
  la verifica funziona solo leggendo il codice dai log PM2: va attivato Skebby prima di aprire
  l'app ai clienti. Nei log il numero è sempre mascherato.

## Logica di dominio — Livelli e convenzioni

- I **livelli** (es. Standard, Oro, Platinum) sono DINAMICI: si calcolano dal numero di scansioni
  (visite) in una finestra mobile configurabile (default: ultimi 90 giorni). Le soglie e gli sconti
  si configurano da `/admin`, non sono hardcoded.
- Il ricalcolo del livello avviene a ogni scansione (non serve un cron per la Tappa 1).
- Le **convenzioni** sono STATICHE: il cliente le attiva inserendo un codice convenzione nel profilo.
  Sono una dimensione separata dai livelli.
- Alla scansione, l'operatore vede: nome cliente, livello con sconto, eventuale convenzione con sconto.
  In Tappa 1 lo sconto si applica in cassa manualmente; l'integrazione API TGS arriverà in una fase
  successiva — strutturare il codice della scansione in modo che il punto di aggancio sia isolato
  (un service `cassaService` oggi vuoto/log-only).

## Logica di dominio — Promozioni "da caricare" (migrazione 003)

- L'admin crea una promozione (`/admin/promozioni`): tipo `sconto_percentuale` | `prezzo_fisso` |
  `omaggio` | `messaggio`, periodo dal/al, fascia oraria e giorni della settimana facoltativi
  (0 = domenica come `Date.getDay()`), destinatari facoltativi (livello, sede), usi per cliente
  (NULL = illimitati). Stati: `bozza` → `pubblicata` → `archiviata`. Si elimina solo una bozza mai
  pubblicata; il resto si archivia per non perdere caricamenti e utilizzi.
- Il cliente vede in bacheca (`/promozioni`) le promo pubblicate non scadute destinate a lui e le
  **carica** (`promozioni_clienti`). Una promo non caricata per quel cliente NON vale: è il punto
  della funzione (creare interazione), non un limite da aggirare.
- Alla scansione l'operatore riceve solo le promo caricate, valide in quell'istante e in quella sede,
  con usi residui (`promozioniService.caricateUtilizzabili`); applica lo sconto in cassa e preme
  "Applicata" (`POST /operatore/promozioni/:id/usa`), che scrive `promozioni_utilizzi`. Il server
  ricontrolla tutto: mai fidarsi di ciò che l'operatore ha a schermo.
- La regola di validità è UNA sola (`promozioniService.validaOra`) e usa l'ora locale del server
  (quella dei locali). Non duplicarla nel frontend: il client mostra, il server decide.
- Le notifiche push per avvisare i clienti delle promo arrivano in una fase successiva (richiedono
  HTTPS su dominio pubblico).

## Integrazione TGS (futura, non in Tappa 1)

TGS Retail ha confermato la disponibilità di API. Quando arriverà la documentazione:
- l'integrazione vivrà in `server/services/tgs/`
- nessuna chiamata TGS deve bloccare il flusso di scansione (fail-open: se TGS non risponde,
  la scansione va comunque a buon fine e lo sconto si applica a mano)

## Convenzioni di codice

- Backend: struttura routes/ → controllers/ → services/ → db. Query parametrizzate sempre (pg, mai string interpolation).
- Frontend: componenti funzionali, fetch centralizzato in `src/api.js` con gestione token.
- Commit: messaggi in italiano, un commit per funzionalità completa.
