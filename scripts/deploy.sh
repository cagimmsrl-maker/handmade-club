#!/usr/bin/env bash
# =====================================================================
#  deploy.sh — deploy di Handmade Club (app clienti) sul VPS
#
#  Sequenza (ORDINE SACRO, non invertire):
#    0. controlli preliminari
#    1. backup del database
#    2. migrazioni pendenti (ON_ERROR_STOP, transazione dentro il file)
#    3. pm2 restart backend + attesa che risponda
#    4. build frontend in cartella temporanea + scambio atomico di dist
#    5. verifica finale (check.sh)
#
#  Uso:
#    ./scripts/deploy.sh              deploy di quello che c'è nel repo
#    ./scripts/deploy.sh --pull       prima fa git pull (per GitHub Action)
#    ./scripts/deploy.sh --dry-run    mostra cosa farebbe, non tocca nulla
#
#  Al primo errore si ferma. Il DB NON viene mai ripristinato in
#  automatico: ogni migrazione ha il suo BEGIN/COMMIT quindi un errore
#  non lascia mezze tabelle. Per tornare indietro: ./scripts/rollback.sh
# =====================================================================
set -euo pipefail

REPO="/var/www/handmade-club"
SERVER="$REPO/server"
CLIENT="$REPO/client"
DIST="$CLIENT/dist"          # servita da Express (server/index.js), nginx davanti su club.handmadecafe.it
BACKUP_DIR="/root/backups/handmade-club"
DB="handmade_clienti"
DB_USER="hclub"
PM2_APP="handmade-club"
BACKEND_URL="http://127.0.0.1:3002/api/salute"
LOG="$BACKUP_DIR/deploy.log"
KEEP_BACKUPS=30

PULL=0; DRY=0
for a in "$@"; do
  case "$a" in
    --pull) PULL=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "argomento sconosciuto: $a"; exit 2 ;;
  esac
done

TS="$(date +%F_%H%M%S)"
mkdir -p "$BACKUP_DIR"

log()  { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
ok()   { log "  OK  $*"; }
fail() { log "  ERRORE: $*"; log "DEPLOY FALLITO al passo: $STEP"; exit 1; }
run()  { if [ "$DRY" = 1 ]; then log "  (dry-run) $*"; else "$@"; fi; }
psql_db() { sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

log "================ DEPLOY $TS ================"

# ---------- 0. controlli preliminari ----------
STEP="controlli preliminari"
[ "$(id -u)" = 0 ] || fail "va lanciato come root"
cd "$REPO" || fail "repo non trovato in $REPO"
command -v pm2 >/dev/null || fail "pm2 non trovato"
command -v psql >/dev/null || fail "psql non trovato"
command -v npm >/dev/null || fail "npm non trovato"
sudo -u postgres psql -d "$DB" -c "select 1" >/dev/null 2>&1 || fail "database $DB non raggiungibile"

if [ "$PULL" = 1 ]; then
  BEFORE="$(md5sum "$0" | cut -d' ' -f1)"
  run git pull --ff-only || fail "git pull fallito (conflitti? token scaduto?)"
  # se il pull ha cambiato questo script, si rilancia la versione nuova
  # (bash legge lo script a pezzi: proseguire con il file cambiato sotto i piedi è rischioso)
  if [ "$DRY" = 0 ] && [ "$(md5sum "$0" | cut -d' ' -f1)" != "$BEFORE" ]; then
    log "  deploy.sh aggiornato dal pull: rilancio la versione nuova"
    exec "$0"
  fi
fi

if [ -n "$(git status --porcelain)" ]; then
  log "  ATTENZIONE: ci sono modifiche non committate nel repo:"
  git status --short | tee -a "$LOG"
fi
COMMIT="$(git rev-parse --short HEAD)"
ok "repo su commit $COMMIT"

# ---------- 1. backup DB ----------
STEP="backup database"
BACKUP_FILE="$BACKUP_DIR/backup_pre_deploy_${TS}_${COMMIT}.sql"
run bash -c "sudo -u postgres pg_dump '$DB' > '$BACKUP_FILE'" || fail "pg_dump fallito"
if [ "$DRY" = 0 ]; then
  SIZE=$(stat -c %s "$BACKUP_FILE")
  [ "$SIZE" -gt 10000 ] || fail "backup sospetto: solo $SIZE byte"
  ok "backup $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
  echo "$BACKUP_FILE" > "$BACKUP_DIR/.last_backup"
  # pulizia: tiene gli ultimi N backup pre-deploy
  ls -1t "$BACKUP_DIR"/backup_pre_deploy_*.sql 2>/dev/null | tail -n +$((KEEP_BACKUPS+1)) | xargs -r rm -f
fi

# ---------- 2. migrazioni ----------
STEP="migrazioni"
# Convenzione di questo repo: migrations/NNN_descrizione.sql, ogni file ha
# il suo BEGIN/COMMIT e si registra da solo in schema_migrations(versione INTEGER).
# La versione è il prefisso numerico del nome file.
APPLIED=$(sudo -u postgres psql -d "$DB" -tAc "select versione from schema_migrations" 2>/dev/null) \
  || fail "impossibile leggere schema_migrations"

PENDING=(); SEEN=" "
for f in $(ls -1 "$REPO"/migrations/*.sql 2>/dev/null | sort); do
  name=$(basename "$f")
  prefix="${name%%_*}"
  [[ "$prefix" =~ ^[0-9]{3}$ ]] || fail "nome migrazione non conforme (atteso NNN_descrizione.sql): $name"
  v=$((10#$prefix))
  case "$SEEN" in *" $v "*) fail "due migrazioni con la stessa versione $prefix" ;; esac
  SEEN="$SEEN$v "
  grep -qx "$v" <<<"$APPLIED" || PENDING+=("$f")
done

if [ ${#PENDING[@]} -eq 0 ]; then
  ok "nessuna migrazione pendente"
else
  for f in "${PENDING[@]}"; do
    name=$(basename "$f"); v=$((10#${name%%_*}))
    log "  applico $name"
    if [ "$DRY" = 0 ]; then
      # SET ROLE: gli oggetti nuovi restano di proprietà di $DB_USER come quelli esistenti.
      # Niente -1: il file ha già BEGIN/COMMIT; con ON_ERROR_STOP un errore
      # chiude la sessione a transazione aperta = rollback, DB intatto.
      psql_db -c "set role $DB_USER" -f "$f" \
        || fail "migrazione $name fallita (rollback automatico, DB intatto)"
      if ! sudo -u postgres psql -d "$DB" -tAc "select 1 from schema_migrations where versione=$v" | grep -q 1; then
        log "  ATTENZIONE: $name non si è registrata in schema_migrations: la registro io"
        psql_db -c "insert into schema_migrations(versione, descrizione) values ($v, '$name (registrata da deploy.sh)')" \
          || fail "registrazione di $name in schema_migrations fallita (la migrazione È applicata: registrala a mano)"
      fi
    fi
    ok "$name applicata"
  done
fi

# permessi: rete di sicurezza se qualche oggetto non fosse di $DB_USER
run psql_db \
  -c "grant all privileges on all tables in schema public to $DB_USER" \
  -c "grant all privileges on all sequences in schema public to $DB_USER" \
  -c "grant execute on all functions in schema public to $DB_USER" \
  || fail "GRANT a $DB_USER falliti"
ok "permessi a $DB_USER"

# ---------- 3. backend ----------
STEP="restart backend"
if [ -f "$SERVER/package-lock.json" ]; then
  # installa solo se il lock è cambiato rispetto all'ultimo deploy
  LOCK_HASH=$(md5sum "$SERVER/package-lock.json" | cut -d' ' -f1)
  if [ "$(cat "$BACKUP_DIR/.server_lock_hash" 2>/dev/null)" != "$LOCK_HASH" ]; then
    log "  dipendenze backend cambiate: npm ci"
    run bash -c "cd '$SERVER' && npm ci --omit=dev" || fail "npm ci backend fallito"
    [ "$DRY" = 0 ] && echo "$LOCK_HASH" > "$BACKUP_DIR/.server_lock_hash"
  fi
fi
run pm2 restart "$PM2_APP" --update-env >/dev/null || fail "pm2 restart fallito"
if [ "$DRY" = 0 ]; then
  for i in $(seq 1 20); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$BACKEND_URL" || true)
    [ "$code" = "200" ] && break
    sleep 1
  done
  [ "$code" = "200" ] || { pm2 logs "$PM2_APP" --lines 30 --nostream | tee -a "$LOG"; fail "backend non risponde dopo il restart (HTTP $code su $BACKEND_URL)"; }
  ok "backend online (HTTP $code), uptime $(pm2 jlist | python3 -c 'import sys,json;[print(int((__import__("time").time()*1000-p["pm2_env"]["pm_uptime"])/1000),"s") for p in json.load(sys.stdin) if p["name"]=="'"$PM2_APP"'"]' 2>/dev/null || echo '?')"
fi

# ---------- 4. frontend ----------
STEP="build frontend"
DIST_NEW="$CLIENT/dist_new_$TS"
if [ -f "$CLIENT/package-lock.json" ]; then
  LOCK_HASH=$(md5sum "$CLIENT/package-lock.json" | cut -d' ' -f1)
  if [ "$(cat "$BACKUP_DIR/.client_lock_hash" 2>/dev/null)" != "$LOCK_HASH" ]; then
    log "  dipendenze frontend cambiate: npm ci"
    run bash -c "cd '$CLIENT' && npm ci" || fail "npm ci frontend fallito"
    [ "$DRY" = 0 ] && echo "$LOCK_HASH" > "$BACKUP_DIR/.client_lock_hash"
  fi
fi
# build FUORI da dist: si continua a servire la versione vecchia finché non è pronta
run bash -c "cd '$CLIENT' && npx vite build --outDir '$DIST_NEW' --emptyOutDir" || fail "build frontend fallita (dist attuale intatto)"
if [ "$DRY" = 0 ]; then
  [ -f "$DIST_NEW/index.html" ] || fail "build senza index.html"
  rm -rf "$CLIENT/dist_prev"
  [ -d "$DIST" ] && mv "$DIST" "$CLIENT/dist_prev"
  mv "$DIST_NEW" "$DIST"
  ok "frontend pubblicato (versione precedente in dist_prev)"
fi

# ---------- 5. verifica ----------
STEP="verifica finale"
if [ "$DRY" = 0 ]; then
  "$REPO/scripts/check.sh" || fail "check.sh ha trovato problemi: vedi sopra. Per tornare indietro: ./scripts/rollback.sh"
fi

log "DEPLOY COMPLETATO — commit $COMMIT, backup $BACKUP_FILE"
log "La PWA si aggiorna da sola (registerType autoUpdate) alla prossima apertura."
