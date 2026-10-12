import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// "Korpa": every delete first stores a full copy of the row (and the rows that
// would be lost with it) in deleted_records, so anything can be restored later.

export type TrashEntity = 'property' | 'buyer' | 'owner' | 'project' | 'user' | 'price_list_investor' | 'price_list_unit';

interface EntityDef {
  table: string;
  label: (row: Record<string, unknown>) => string;
  // Child rows removed by ON DELETE CASCADE (or otherwise lost) together with the row
  related: { table: string; column: string }[];
}

const ENTITIES: Record<TrashEntity, EntityDef> = {
  property: {
    table: 'properties',
    label: r => `${r.code ? `[${r.code}] ` : ''}${r.title}`,
    related: [
      { table: 'property_audit_log', column: 'property_id' },
      { table: 'ad_listings', column: 'property_id' },
    ],
  },
  buyer: {
    table: 'buyers',
    label: r => `${r.first_name} ${r.last_name}`.trim(),
    related: [{ table: 'buyer_interactions', column: 'buyer_id' }],
  },
  owner: { table: 'owners', label: r => `${r.first_name} ${r.last_name}`.trim(), related: [] },
  project: { table: 'projects', label: r => String(r.name), related: [] },
  user: { table: 'users', label: r => `${r.full_name} (${r.username})`, related: [] },
  price_list_investor: {
    table: 'price_list_investors',
    label: r => String(r.name),
    related: [{ table: 'price_list_units', column: 'investor_id' }],
  },
  price_list_unit: { table: 'price_list_units', label: r => String(r.unit_name), related: [] },
};

export const ENTITY_LABELS: Record<TrashEntity, string> = {
  property: 'Nekretnina',
  buyer: 'Kupac',
  owner: 'Vlasnik',
  project: 'Projekat',
  user: 'Korisnik',
  price_list_investor: 'Investitor (cenovnik)',
  price_list_unit: 'Stan u cenovniku',
};

interface TrashData {
  row: Record<string, unknown>;
  related: Record<string, Record<string, unknown>[]>;
  // Projects: properties that were linked and get unlinked on delete
  linkedPropertyIds?: string[];
}

export function ensureTrashTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deleted_records (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT,
      data TEXT NOT NULL,
      deleted_by TEXT,
      deleted_by_name TEXT,
      deleted_at TEXT DEFAULT (datetime('now')),
      restored_at TEXT,
      restored_by_name TEXT
    );
  `);
}

/**
 * Copies the row into the trash and then deletes it, in one transaction.
 * Returns false if the row doesn't exist.
 */
export function deleteWithTrash(
  db: Database.Database,
  entity: TrashEntity,
  id: string,
  user: { id: string; full_name: string },
  extraDelete?: () => void,
): boolean {
  const def = ENTITIES[entity];
  const row = db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return false;

  const data: TrashData = { row, related: {} };
  for (const rel of def.related) {
    data.related[rel.table] = db.prepare(`SELECT * FROM ${rel.table} WHERE ${rel.column} = ?`).all(id) as Record<string, unknown>[];
  }
  if (entity === 'project') {
    data.linkedPropertyIds = (db.prepare('SELECT id FROM properties WHERE project_id = ?').all(id) as { id: string }[]).map(p => p.id);
  }

  db.transaction(() => {
    db.prepare(`
      INSERT INTO deleted_records (id, entity, entity_id, label, data, deleted_by, deleted_by_name, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), entity, id, def.label(row), JSON.stringify(data), user.id, user.full_name);
    extraDelete?.();
    db.prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(id);
  })();
  return true;
}

function insertRow(db: Database.Database, table: string, row: Record<string, unknown>, orIgnore = false) {
  // Only columns that still exist (schema may have changed since the delete)
  const existing = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name));
  const cols = Object.keys(row).filter(c => existing.has(c));
  db.prepare(
    `INSERT ${orIgnore ? 'OR IGNORE ' : ''}INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  ).run(...cols.map(c => row[c] as never));
}

/** Puts a trashed record back. Throws with a readable message if that's not possible. */
export function restoreFromTrash(db: Database.Database, trashId: string, user: { full_name: string }) {
  const rec = db.prepare('SELECT * FROM deleted_records WHERE id = ?').get(trashId) as
    { entity: TrashEntity; entity_id: string; data: string; restored_at: string | null } | undefined;
  if (!rec) throw new Error('Zapis nije pronađen u korpi');
  if (rec.restored_at) throw new Error('Ovaj zapis je već vraćen');

  const def = ENTITIES[rec.entity];
  const data = JSON.parse(rec.data) as TrashData;

  if (db.prepare(`SELECT 1 FROM ${def.table} WHERE id = ?`).get(rec.entity_id)) {
    throw new Error('Ovaj zapis već postoji u CRM-u');
  }
  if (rec.entity === 'property' && data.row.owner_id &&
      !db.prepare('SELECT 1 FROM owners WHERE id = ?').get(data.row.owner_id)) {
    throw new Error('Prvo vratite vlasnika ove nekretnine (i on je obrisan)');
  }
  if (rec.entity === 'price_list_unit' &&
      !db.prepare('SELECT 1 FROM price_list_investors WHERE id = ?').get(data.row.investor_id)) {
    throw new Error('Prvo vratite investitora kome ovaj stan pripada');
  }

  db.transaction(() => {
    insertRow(db, def.table, data.row);
    for (const [table, rows] of Object.entries(data.related)) {
      for (const r of rows) insertRow(db, table, r, true);
    }
    if (data.linkedPropertyIds?.length) {
      const relink = db.prepare("UPDATE properties SET project_id = ? WHERE id = ? AND (project_id IS NULL OR project_id = '')");
      for (const pid of data.linkedPropertyIds) relink.run(rec.entity_id, pid);
    }
    db.prepare("UPDATE deleted_records SET restored_at = datetime('now'), restored_by_name = ? WHERE id = ?")
      .run(user.full_name, trashId);
  })();
}
