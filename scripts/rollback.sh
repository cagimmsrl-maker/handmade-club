#!/usr/bin/env bash
# =====================================================================
#  rollback.sh — torna alla versione precedente.
#    ./scripts/rollback.sh            rimette frontend precedente + backend al commit precedente
#    ./scripts/rollback.sh --db       in più RIPRISTINA il database dall'ultimo backup
#                                     (perde i dati inseriti dopo il backup: chiede conferma)
# =====================================================================
set -euo pipefail
REPO="/var/www/handmade-club"; CLIENT="$REPO/client"
BACKUP_DIR="/root/backups/handmade-club"; DB="handmade_clienti"; DB_USER="hclub"; PM2_APP="handmade-club"
DO_DB=0; [ "${1:-}" = "--db" ] && DO_DB=1
cd "$REPO"

echo "Commit attuale: $(git log -1 --oneline)"
echo "Torno a:        $(git log -1 --oneline HEAD~1)"
read -rp "Confermi il rollback del codice? [s/N] " r; [ "$r" = s ] || exit 1

git checkout -q HEAD~1 -- server/ && echo "backend al commit precedente"
pm2 restart "$PM2_APP" --update-env >/dev/null && echo "backend riavviato"

if [ -d "$CLIENT/dist_prev" ]; then
  rm -rf "$CLIENT/dist_rollback"; mv "$CLIENT/dist" "$CLIENT/dist_rollback"
  mv "$CLIENT/dist_prev" "$CLIENT/dist"; echo "frontend precedente ripristinato"
else echo "nessun dist_prev: frontend non toccato"; fi

if [ "$DO_DB" = 1 ]; then
  B=$(cat "$BACKUP_DIR/.last_backup" 2>/dev/null || true)
  [ -f "$B" ] || { echo "nessun backup registrato"; exit 1; }
  echo "ATTENZIONE: ripristino DB da $B — i dati inseriti dopo quel momento VANNO PERSI."
  read -rp "Scrivi RIPRISTINA per confermare: " r; [ "$r" = RIPRISTINA ] || exit 1
  sudo -u postgres pg_dump "$DB" > "$BACKUP_DIR/backup_pre_rollback_$(date +%F_%H%M%S).sql"
  pm2 stop "$PM2_APP" >/dev/null   # chiude le connessioni aperte, altrimenti drop database fallisce
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "drop database $DB" -c "create database $DB owner $DB_USER"
  sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$B"
  pm2 restart "$PM2_APP" >/dev/null; echo "database ripristinato"
fi
"$REPO/scripts/check.sh" || true
echo "Rollback fatto. Nota: il repo ha ora server/ allo stato precedente ma NON è un commit: sistema con git prima del prossimo deploy."
