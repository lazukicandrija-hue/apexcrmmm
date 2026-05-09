#!/bin/bash
# Apex CRM - Deploy Script (Safe Database Version)
# Usage: ./deploy.sh
#
# CRITICAL: The database lives in /opt/apex-crm/data/ and is NEVER touched
# by git pull or npm run build. Backups are created before every deployment.

set -e

echo "🚀 Deploying Apex CRM..."

# Push to GitHub
echo "📦 Pushing to GitHub..."
git add -A
git commit -m "Update: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "Nothing to commit"
git push origin main

# Deploy to server
echo "🔄 Deploying to server..."
ssh root@46.101.250.53 '
  set -e
  cd /opt/apex-crm

  # ===== STEP 1: Create persistent data directory if it does not exist =====
  mkdir -p /opt/apex-crm/data
  mkdir -p /opt/apex-crm/data/backups
  mkdir -p /opt/apex-crm/data/uploads

  # ===== STEP 2: Backup the database BEFORE doing anything =====
  if [ -f /opt/apex-crm/data/apex-crm.db ]; then
    BACKUP_NAME="apex-crm_$(date +%Y%m%d_%H%M%S).db"
    cp /opt/apex-crm/data/apex-crm.db /opt/apex-crm/data/backups/$BACKUP_NAME
    echo "✅ Database backed up: $BACKUP_NAME"
    # Also checkpoint WAL to ensure all data is in the main db file
    sqlite3 /opt/apex-crm/data/apex-crm.db "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
  fi

  # ===== STEP 3: Pull code (this NEVER touches the data directory) =====
  git pull origin main

  # ===== STEP 4: Build the application =====
  npm install
  npm run build

  # ===== STEP 5: Copy static assets to standalone =====
  cp -r public .next/standalone/public 2>/dev/null || true
  cp -r .next/static .next/standalone/.next/static 2>/dev/null || true

  # ===== STEP 6: Remove any stale database from standalone (it must use /data/) =====
  rm -f .next/standalone/apex-crm.db
  rm -f .next/standalone/apex-crm.db-wal
  rm -f .next/standalone/apex-crm.db-shm

  # ===== STEP 7: Restart with DATA_DIR environment variable =====
  pm2 delete apex-crm 2>/dev/null || true
  cd /opt/apex-crm/.next/standalone
  DATA_DIR=/opt/apex-crm/data PORT=3000 pm2 start server.js --name apex-crm --cwd /opt/apex-crm/.next/standalone
  pm2 save

  echo ""
  echo "✅ Deploy complete!"
  echo "📂 Database location: /opt/apex-crm/data/apex-crm.db"
  echo "📦 Backups: /opt/apex-crm/data/backups/"

  # ===== STEP 8: Clean up old backups (keep last 30) =====
  cd /opt/apex-crm/data/backups
  ls -t *.db 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
'

echo ""
echo "✅ CRM deployed! Visit: https://crm.apexrealestate.rs"
echo "📂 Database is safely stored in /opt/apex-crm/data/"
