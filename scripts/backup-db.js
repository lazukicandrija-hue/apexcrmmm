// Consistent online backup of the CRM SQLite database (includes data still in the WAL file).
// Usage (on the server): node scripts/backup-db.js <label>
// Writes $DATA_DIR/backups/apex-crm_<label>_<timestamp>.db and rotates old copies of the same label.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || '/opt/apex-crm/data';
const label = (process.argv[2] || 'manual').replace(/[^a-z0-9-]/gi, '');
const KEEP = { daily: 60, deploy: 30 }[label] || 30;

const src = path.join(DATA_DIR, 'apex-crm.db');
const dir = path.join(DATA_DIR, 'backups');
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
const dest = path.join(dir, `apex-crm_${label}_${stamp}.db`);

const db = new Database(src, { readonly: true, fileMustExist: true });
db.backup(dest)
  .then(() => {
    db.close();
    const check = new Database(dest);
    check.pragma('journal_mode = DELETE'); // single self-contained file, no -wal/-shm
    const counts = ['properties', 'buyers', 'projects', 'users']
      .map(t => `${t}=${check.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c}`).join(' ');
    check.close();
    console.log(`Backup OK: ${dest} (${counts})`);

    // Rotate only this label's backups; never touch other files in the folder
    const prefix = `apex-crm_${label}_`;
    fs.readdirSync(dir)
      .filter(f => f.startsWith(prefix) && f.endsWith('.db'))
      .sort()
      .reverse()
      .slice(KEEP)
      .forEach(f => fs.unlinkSync(path.join(dir, f)));
  })
  .catch(err => {
    console.error('Backup FAILED:', err.message);
    process.exit(1);
  });
