import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'apex-crm.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
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

  // Seed admin user if no users exist
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    seedDatabase(database);
  }
}

function seedDatabase(database: Database.Database) {
  const hashedPassword = bcrypt.hashSync('apex2026', 10);
  const adminId = uuidv4();

  database.prepare(`
    INSERT INTO users (id, username, password, full_name, role) 
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, 'admin', hashedPassword, 'Apex Administrator', 'admin');

  const agentPassword = bcrypt.hashSync('agent123', 10);
  database.prepare(`
    INSERT INTO users (id, username, password, full_name, role) 
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'marko', agentPassword, 'TEST — Marko Petrović', 'agent');

  // Seed Owners
  const owners = [
    { id: uuidv4(), first_name: 'TEST Jovan', last_name: 'Nikolić', phone: '064/111-2222', email: 'test.jovan@test.com', notes: 'TEST — Dugogodišnji klijent. Ima više nekretnina u centru.' },
    { id: uuidv4(), first_name: 'TEST Milica', last_name: 'Đorđević', phone: '065/333-4444', email: 'test.milica@test.com', notes: 'TEST — Nasledila stan od roditelja. Želi brzu prodaju.' },
    { id: uuidv4(), first_name: 'TEST Stefan', last_name: 'Kovačević', phone: '063/555-6666', email: 'test.stefan@test.com', notes: 'TEST — Investitor. Gradi novogradnju na Limanu.' },
    { id: uuidv4(), first_name: 'TEST Ana', last_name: 'Popović', phone: '061/777-8888', email: 'test.ana@test.com', notes: 'TEST — Prodaje lokal na Bulevaru. Cena fiksna.' },
    { id: uuidv4(), first_name: 'TEST Dragan', last_name: 'Milosavljević', phone: '069/999-0000', email: 'test.dragan@test.com', notes: 'TEST — Iznajmljuje stanove za studente. Ima 3 stana.' },
  ];

  const insertOwner = database.prepare(`
    INSERT INTO owners (id, first_name, last_name, phone, email, notes) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const o of owners) {
    insertOwner.run(o.id, o.first_name, o.last_name, o.phone, o.email, o.notes);
  }

  // Seed Properties
  const twoWeeksFromNow = new Date(); twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  const oneWeekFromNow = new Date(); oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
  const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const properties = [
    {
      id: uuidv4(), title: 'TEST — Četvorosoban Stan Centar', description: 'TEST — Luksuzan četvorosoban stan u srcu Novog Sada. Potpuno renoviran sa premium materijalima.',
      location: 'Centar, Novi Sad', price: 454230, type: 'Starogradnja', area: 126, rooms: 4, status: 'Aktivna', owner_id: owners[0].id, published: 1,
      next_action_date: twoWeeksFromNow.toISOString().split('T')[0],
    },
    {
      id: uuidv4(), title: 'TEST — Novogradnja Liman IV', description: 'TEST — Moderan dvosoban stan u novogradnji na Limanu IV.',
      location: 'Liman IV, Novi Sad', price: 185000, type: 'Novogradnja', area: 62, rooms: 2, status: 'Aktivna', owner_id: owners[2].id, published: 1,
      next_action_date: oneWeekFromNow.toISOString().split('T')[0],
    },
    {
      id: uuidv4(), title: 'TEST — Starogradnja Podbara', description: 'TEST — Trosoban stan u staroj gradnji na Podbari. Visoki plafoni, originalni parketi.',
      location: 'Podbara, Novi Sad', price: 120000, type: 'Starogradnja', area: 85, rooms: 3, status: 'U pregovoru', owner_id: owners[1].id, published: 0,
      next_action_date: threeDaysAgo.toISOString().split('T')[0],
    },
    {
      id: uuidv4(), title: 'TEST — Poslovni Prostor Bulevar', description: 'TEST — Poslovni prostor na frekventnoj lokaciji na Bulevaru oslobođenja.',
      location: 'Bulevar, Novi Sad', price: 210000, type: 'Lokali', area: 95, rooms: 3, status: 'Aktivna', owner_id: owners[3].id, published: 1,
      next_action_date: null,
    },
    {
      id: uuidv4(), title: 'TEST — Garsonjera Grbavica', description: 'TEST — Nameštena garsonjera za izdavanje na Grbavici.',
      location: 'Grbavica, Novi Sad', price: 350, type: 'Rente', area: 28, rooms: 1, status: 'Aktivna', owner_id: owners[4].id, published: 1,
      next_action_date: null,
    },
  ];

  const insertProperty = database.prepare(`
    INSERT INTO properties (id, title, description, location, price, type, area, rooms, status, owner_id, published, next_action_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertNote = database.prepare(`
    INSERT INTO notes_history (id, entity_type, entity_id, content, created_at) VALUES (?, ?, ?, ?, ?)
  `);

  for (const p of properties) {
    insertProperty.run(p.id, p.title, p.description, p.location, p.price, p.type, p.area, p.rooms, p.status, p.owner_id, p.published, p.next_action_date);
  }

  // Seed some notes history for the first property
  insertNote.run(uuidv4(), 'property', properties[0].id, 'TEST — Ubačena nekretnina u ponudu. Vlasnik potpisao ugovor o posredovanju.', new Date(Date.now() - 14 * 86400000).toISOString());
  insertNote.run(uuidv4(), 'property', properties[0].id, 'TEST — Pozvao vlasnika — cena ostaje ista. Želi da radi sa nama.', new Date(Date.now() - 7 * 86400000).toISOString());
  insertNote.run(uuidv4(), 'property', properties[0].id, 'TEST — Pokazao stan kupcu. Stan mu se sviđa, razmišlja. Follow-up za nedelju dana.', new Date(Date.now() - 2 * 86400000).toISOString());

  // Seed notes for owner
  insertNote.run(uuidv4(), 'owner', owners[0].id, 'TEST — Inicijalni sastanak — dogovoren ugovor o posredovanju.', new Date(Date.now() - 14 * 86400000).toISOString());
  insertNote.run(uuidv4(), 'owner', owners[0].id, 'TEST — Vlasnik pominjao da ima još jedan stan koji bi možda prodao.', new Date(Date.now() - 5 * 86400000).toISOString());

  // Seed Buyers
  const today = new Date();
  const buyerThreeDaysAgo = new Date(today); buyerThreeDaysAgo.setDate(today.getDate() - 3);
  const twoDaysFromNow = new Date(today); twoDaysFromNow.setDate(today.getDate() + 2);
  const fiveDaysFromNow = new Date(today); fiveDaysFromNow.setDate(today.getDate() + 5);

  const buyers = [
    {
      id: uuidv4(), first_name: 'TEST Petar', last_name: 'Janković', phone: '064/222-3333', email: 'test.petar@test.com',
      desired_type: 'Novogradnja', location: 'Novi Sad', budget: 200000, notes: 'TEST — Traži dvosoban ili trosoban u novogradnji. Bitan mu je parking i lift.',
      next_action_date: buyerThreeDaysAgo.toISOString().split('T')[0], status: 'Aktivan',
    },
    {
      id: uuidv4(), first_name: 'TEST Jelena', last_name: 'Savić', phone: '065/444-5555', email: 'test.jelena@test.com',
      desired_type: 'Starogradnja', location: 'Centar, Novi Sad', budget: 350000, notes: 'TEST — Premium kupac. Zanima je stan sa pogledom na Dunav, minimum 100m².',
      next_action_date: twoDaysFromNow.toISOString().split('T')[0], status: 'Aktivan',
    },
    {
      id: uuidv4(), first_name: 'TEST Nikola', last_name: 'Branković', phone: '063/666-7777', email: 'test.nikola@test.com',
      desired_type: 'Rente', location: 'Grbavica, Novi Sad', budget: 500, notes: 'TEST — Student. Traži garsonjeru za rentiranje blizu fakulteta.',
      next_action_date: fiveDaysFromNow.toISOString().split('T')[0], status: 'Aktivan',
    },
  ];

  const insertBuyer = database.prepare(`
    INSERT INTO buyers (id, first_name, last_name, phone, email, desired_type, location, budget, notes, next_action_date, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of buyers) {
    insertBuyer.run(b.id, b.first_name, b.last_name, b.phone, b.email, b.desired_type, b.location, b.budget, b.notes, b.next_action_date, b.status);
    // Seed notes history for buyers
    insertNote.run(uuidv4(), 'buyer', b.id, `TEST — Inicijalni kontakt — ${b.notes}`, new Date(Date.now() - 10 * 86400000).toISOString());
    insertNote.run(uuidv4(), 'buyer', b.id, 'TEST — Poslat email sa ponudama nekretnina.', new Date(Date.now() - 7 * 86400000).toISOString());
    insertNote.run(uuidv4(), 'buyer', b.id, 'TEST — Telefonski razgovor — interesuje ga par nekretnina, zakazano gledanje.', new Date(Date.now() - 3 * 86400000).toISOString());
  }
}
