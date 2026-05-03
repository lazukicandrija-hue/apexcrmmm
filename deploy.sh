#!/bin/bash
# Apex CRM - Deploy Script
# Usage: ./deploy.sh

set -e

echo "🚀 Deploying Apex CRM..."

# Push to GitHub
echo "📦 Pushing to GitHub..."
git add -A
git commit -m "Update: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "Nothing to commit"
git push origin main

# Deploy to server
echo "🔄 Deploying to server..."
ssh root@46.101.250.53 "
  cd /opt/apex-crm
  git pull origin main
  npm install
  npm run build
  cp -r public .next/standalone/public 2>/dev/null
  cp -r .next/static .next/standalone/.next/static 2>/dev/null
  pm2 restart apex-crm
  echo '✅ Deploy complete!'
"

echo ""
echo "✅ CRM deployed! Visit: https://crm.apexrealestate.rs"
