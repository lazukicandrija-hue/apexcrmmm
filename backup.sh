#!/bin/bash
# Apex CRM - download a fresh, verified copy of the production database to this Mac.
# Usage: ./backup.sh
set -e

SERVER=root@209.38.255.31
LOCAL_BACKUPS=~/APEX-CRM-backups
mkdir -p $LOCAL_BACKUPS

OUT=$(ssh $SERVER 'cd /opt/apex-crm && DATA_DIR=/opt/apex-crm/data node scripts/backup-db.js manual')
echo "$OUT"
FILE=$(echo "$OUT" | sed -n 's/^Backup OK: \([^ ]*\).*/\1/p')
scp -q "$SERVER:$FILE" "$LOCAL_BACKUPS/"
echo "💾 Saved to $LOCAL_BACKUPS/$(basename $FILE)"
