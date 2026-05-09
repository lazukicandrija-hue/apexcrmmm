import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Use a dedicated persistent data directory that survives deployments.
// On the server, /opt/apex-crm/data/ is outside .next/standalone/ and never gets wiped.
// Locally (dev), fall back to the project root.
function getDbPath(): string {
  // If DATA_DIR env var is set, use it (set on the server)
  if (process.env.DATA_DIR) {
    const dataDir = process.env.DATA_DIR;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'apex-crm.db');
  }
  // Fallback: use project root for local development
  return path.join(process.cwd(), 'apex-crm.db');
}

const DB_PATH = getDbPath();

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Ensure WAL checkpoints happen regularly so data isn't stuck in WAL file
    db.pragma('wal_autocheckpoint = 100');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin','agent')) DEFAULT 'agent',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      notes TEXT DEFAULT '',
      location TEXT NOT NULL,
      price REAL NOT NULL,
      type TEXT CHECK(type IN ('Novogradnja','Starogradnja','Rente','Lokali')) NOT NULL,
      area REAL,
      rooms INTEGER,
      status TEXT CHECK(status IN ('Aktivna','Prodato','U pregovoru')) DEFAULT 'Aktivna',
      owner_id TEXT NOT NULL REFERENCES owners(id),
      images TEXT DEFAULT '[]',
      published INTEGER DEFAULT 0,
      next_action_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buyers (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      desired_type TEXT,
      location TEXT,
      budget REAL,
      notes TEXT,
      next_action_date TEXT,
      status TEXT CHECK(status IN ('Aktivan','Pauzirana Potraga','Kupio Stan')) DEFAULT 'Aktivan',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buyer_interactions (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT CHECK(entity_type IN ('property', 'owner', 'buyer')) NOT NULL,
      entity_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      permissions TEXT DEFAULT '["read","write"]',
      active INTEGER DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS property_audit_log (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ad_listings (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      status TEXT CHECK(status IN ('draft','published','needs_update','removed')) DEFAULT 'draft',
      external_url TEXT,
      last_synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Projects table for Novogradnja grouping
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT DEFAULT '',
      developer TEXT DEFAULT '',
      total_units INTEGER,
      images TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate: add new property fields (safe to run multiple times)
  const addColumnSafe = (table: string, col: string, type: string) => {
    try { database.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch { /* column already exists */ }
  };
  addColumnSafe('properties', 'floor', 'TEXT');
  addColumnSafe('properties', 'condition', 'TEXT');
  addColumnSafe('properties', 'parking', 'TEXT');
  addColumnSafe('properties', 'terrace', 'TEXT');
  addColumnSafe('properties', 'heating', 'TEXT');
  addColumnSafe('properties', 'cadastral_notes', 'TEXT');
  addColumnSafe('properties', 'contract_signed', 'INTEGER DEFAULT 0');
  addColumnSafe('properties', 'reminder_text', 'TEXT');
  addColumnSafe('properties', 'code', 'TEXT');              // Šifra oglasa: n001, s001, l001, r001
  addColumnSafe('properties', 'project_id', 'TEXT');        // FK to projects (nullable, for Novogradnja)

  // Migrate: add new buyer fields
  addColumnSafe('buyers', 'financing', 'TEXT');         // Keš, Kredit, Kombinovano
  addColumnSafe('buyers', 'desired_rooms', 'TEXT');     // 1, 2, 3, 4+
  addColumnSafe('buyers', 'preferred_locations', 'TEXT'); // JSON array of Novi Sad neighborhoods

  // Migrate: add address detail fields for properties
  addColumnSafe('properties', 'street', 'TEXT');            // Ulica
  addColumnSafe('properties', 'building_number', 'TEXT');   // Broj zgrade/kuće
  addColumnSafe('properties', 'apartment_number', 'TEXT');  // Broj stana

  // Backfill: assign codes to existing properties that don't have one
  backfillPropertyCodes(database);

  // Seed admin user and default agent if no users exist (first run only)
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    seedAdminUsers(database);
  }
}

function seedAdminUsers(database: Database.Database) {
  const hashedPassword = bcrypt.hashSync('apex2026', 10);
  const adminId = uuidv4();

  database.prepare(`
    INSERT INTO users (id, username, password, full_name, role) 
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, 'admin', hashedPassword, 'Apex Administrator', 'admin');

  // Create Isak's agent account
  const agentPassword = bcrypt.hashSync('agent123', 10);
  database.prepare(`
    INSERT INTO users (id, username, password, full_name, role) 
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'isak', agentPassword, 'Isak', 'agent');
}

// ── Property Code Generator ──
const TYPE_PREFIX: Record<string, string> = {
  'Novogradnja': 'n',
  'Starogradnja': 's',
  'Lokali': 'l',
  'Rente': 'r',
};

export function generatePropertyCode(database: Database.Database, type: string): string {
  const prefix = TYPE_PREFIX[type] || 'x';
  // Find the highest existing number for this prefix
  const row = database.prepare(
    `SELECT code FROM properties WHERE code LIKE ? ORDER BY code DESC LIMIT 1`
  ).get(`${prefix}%`) as { code: string } | undefined;

  let nextNum = 1;
  if (row && row.code) {
    const numPart = parseInt(row.code.slice(prefix.length), 10);
    if (!isNaN(numPart)) nextNum = numPart + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

function backfillPropertyCodes(database: Database.Database) {
  const propsWithoutCode = database.prepare(
    `SELECT id, type FROM properties WHERE code IS NULL OR code = '' ORDER BY created_at ASC`
  ).all() as { id: string; type: string }[];

  if (propsWithoutCode.length === 0) return;

  const update = database.prepare('UPDATE properties SET code = ? WHERE id = ?');
  const txn = database.transaction(() => {
    for (const prop of propsWithoutCode) {
      const code = generatePropertyCode(database, prop.type);
      update.run(code, prop.id);
    }
  });
  txn();
}

