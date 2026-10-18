#!/usr/bin/env bash
# =====================================================================
#  check.sh — stato di salute di Handmade Club. Esce 0 se tutto ok, 1 se no.
#  pm2 online e riavviato, backend e frontend che rispondono, DB
#  raggiungibile, migrazioni allineate, nessun errore recente nei log.
# =====================================================================
set -uo pipefail
REPO="/var/www/handmade-club"
DB="handmade_clienti"
DB_USER="hclub"
PM2_APP="handmade-club"
BACKEND_URL="http://127.0.0.1:3002/api/salute"
FRONTEND_URL="http://127.0.0.1:3002/"   # client/dist servito da Express (nessun vhost nginx dedicato per ora)
ERR=0
ok()   { echo "  OK   $*"; }
ko()   { echo "  KO   $*"; ERR=1; }
warn() { echo "  !    $*"; }

echo "--- check $(date '+%F %T') ---"

# pm2
status=$(pm2 jlist 2>/dev/null | python3 -c '
import sys,json,time
for p in json.load(sys.stdin):
    if p["name"]=="'"$PM2_APP"'":
        up=int((time.time()*1000-p["pm2_env"]["pm_uptime"])/1000)
        print(p["pm2_env"]["status"], up, p["pm2_env"].get("restart_time",0))
' 2>/dev/null)
if [ -z "$status" ]; then ko "pm2: processo $PM2_APP non trovato"; else
  set -- $status
  [ "$1" = "online" ] && ok "pm2: $PM2_APP online, uptime ${2}s, riavvii ${3}" || ko "pm2: stato $1"
  [ "$2" -gt 86400 ] && warn "pm2: uptime > 1 giorno — se hai appena fatto deploy, il restart NON è avvenuto"
fi

# backend
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$BACKEND_URL" || echo 000)
[ "$code" = "200" ] && ok "backend: HTTP 200 su /api/salute" || ko "backend: HTTP $code su $BACKEND_URL"

# frontend
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$FRONTEND_URL" || echo 000)
[ "$code" = "200" ] && ok "frontend: HTTP 200" || ko "frontend: HTTP $code su $FRONTEND_URL"
dist_js=$(ls -1 "$REPO"/client/dist/assets/*.js 2>/dev/null | head -1)
[ -n "$dist_js" ] && ok "frontend: dist del $(date -r "$dist_js" '+%F %H:%M')" || ko "frontend: client/dist/assets vuoto"

# database
if sudo -u postgres psql -d "$DB" -tAc "select 1" 2>/dev/null | grep -q 1; then
  ok "db: $DB raggiungibile"
  applied=$(sudo -u postgres psql -d "$DB" -tAc "select versione from schema_migrations" 2>/dev/null)
  missing=""
  for f in $(ls -1 "$REPO"/migrations/*.sql 2>/dev/null | sort); do
    n=$(basename "$f"); v=$((10#${n%%_*}))
    grep -qx "$v" <<<"$applied" || missing="$missing $n"
  done
  last_db=$(sudo -u postgres psql -d "$DB" -tAc "select max(versione) from schema_migrations" 2>/dev/null)
  if [ -z "$missing" ]; then ok "migrazioni: allineate (ultima versione $last_db)"
  else ko "migrazioni: non applicate nel DB:$missing"; fi
  notmine=$(sudo -u postgres psql -d "$DB" -tAc "select count(*) from pg_tables where schemaname='public' and tableowner<>'$DB_USER'")
  [ "$notmine" = "0" ] && ok "db: tutte le tabelle di $DB_USER" || warn "db: $notmine tabelle non di proprietà di $DB_USER (i GRANT del deploy le coprono)"
else ko "db: $DB non raggiungibile"; fi

# log recenti
# Le righe del log pm2 non hanno timestamp: se l'error log non è stato
# scritto dall'avvio del processo in poi, non può contenere errori di
# questa istanza (altrimenti gli errori di ieri rispuntano a ogni check).
loginfo=$(pm2 jlist 2>/dev/null | python3 -c '
import sys,json
for p in json.load(sys.stdin):
    if p["name"]=="'"$PM2_APP"'":
        print(int(p["pm2_env"]["pm_uptime"]/1000), p["pm2_env"].get("pm_err_log_path",""), sep="\t")
' 2>/dev/null)
avvio=${loginfo%%$'\t'*}
errfile=${loginfo#*$'\t'}

if [ -n "$loginfo" ] && [ -n "$errfile" ] && [ -f "$errfile" ] \
   && [ "$(date -r "$errfile" +%s)" -lt "$avvio" ]; then
  ok "log: nessun errore dal riavvio (error log fermo al $(date -r "$errfile" '+%F %H:%M'), processo avviato $(date -d "@$avvio" '+%F %H:%M'))"
else
  errlog=$(pm2 logs "$PM2_APP" --err --lines 50 --nostream 2>/dev/null | grep -Ei 'error|exception|unhandled' | grep -v '^\s*$' | tail -5)
  if [ -n "$errlog" ]; then warn "log: errori recenti nel log pm2 (ultimi 50 righe):"; echo "$errlog" | sed 's/^/       /'; else ok "log: nessun errore nelle ultime 50 righe"; fi
fi

# spazio disco
use=$(df -P / | awk 'NR==2{print $5}' | tr -d %)
[ "$use" -lt 90 ] && ok "disco: ${use}% usato" || ko "disco: ${use}% usato"

echo "--- fine check: $([ $ERR = 0 ] && echo TUTTO OK || echo PROBLEMI) ---"
exit $ERR
