#!/bin/bash
# Apex CRM - Deploy Script (Safe Database Version)
# Usage: ./deploy.sh
#
# CRITICAL: The database lives in /opt/apex-crm/data/ and is NEVER touched
# by git pull or npm run build. A verified backup is made before every deployment
# and a copy is downloaded to this Mac (~/APEX-CRM-backups).

set -e

SERVER=root@209.38.255.31   # droplet "apex-crm" (104.236.69.230 was destroyed on 2026-10-02)
LOCAL_BACKUPS=~/APEX-CRM-backups

echo "🚀 Deploying Apex CRM..."

# Push to GitHub
echo "📦 Pushing to GitHub..."
git add -A
git commit -m "Update: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "Nothing to commit"
git push origin main

# Deploy to server
echo "🔄 Deploying to server..."
ssh $SERVER '
  set -e
  cd /opt/apex-crm

  # ===== STEP 1: Create persistent data directory if it does not exist =====
  mkdir -p /opt/apex-crm/data/backups /opt/apex-crm/data/uploads

  # ===== STEP 2: Pull code (this NEVER touches the data directory) =====
  git pull origin main

  # ===== STEP 3: Backup the database BEFORE building (consistent copy incl. WAL) =====
  if [ -f /opt/apex-crm/data/apex-crm.db ]; then
    DATA_DIR=/opt/apex-crm/data node scripts/backup-db.js deploy
  fi

  # ===== STEP 4: Build the application =====
  npm install
  npm run build

  # ===== STEP 5: Copy static assets to standalone =====
  cp -r public .next/standalone/public 2>/dev/null || true
  cp -r .next/static .next/standalone/.next/static 2>/dev/null || true

  # ===== STEP 6: Remove any stale database from standalone (it must use /data/) =====
  rm -f .next/standalone/apex-crm.db .next/standalone/apex-crm.db-wal .next/standalone/apex-crm.db-shm

  # ===== STEP 7: Restart with DATA_DIR environment variable =====
  pm2 delete apex-crm 2>/dev/null || true
  cd /opt/apex-crm/.next/standalone
  DATA_DIR=/opt/apex-crm/data PORT=3001 pm2 start server.js --name apex-crm --cwd /opt/apex-crm/.next/standalone
  pm2 save

  # ===== STEP 8: Daily automatic backup at 03:00 (installed once, idempotent) =====
  CRON_LINE="0 3 * * * cd /opt/apex-crm && DATA_DIR=/opt/apex-crm/data node scripts/backup-db.js daily >> /opt/apex-crm/data/backups/backup.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v "scripts/backup-db.js daily"; echo "$CRON_LINE" ) | crontab -

  echo ""
  echo "✅ Deploy complete!"
  echo "📂 Database location: /opt/apex-crm/data/apex-crm.db"
  echo "📦 Backups: /opt/apex-crm/data/backups/"
'

# ===== Keep a copy of the newest backup on this Mac (off-server) =====
mkdir -p $LOCAL_BACKUPS
LATEST=$(ssh $SERVER 'ls -t /opt/apex-crm/data/backups/apex-crm_deploy_*.db 2>/dev/null | head -1')
if [ -n "$LATEST" ]; then
  scp -q "$SERVER:$LATEST" "$LOCAL_BACKUPS/" && echo "💾 Local copy: $LOCAL_BACKUPS/$(basename $LATEST)"
fi

echo ""
echo "✅ CRM deployed! Visit: https://crm.apexrealestate.rs"
