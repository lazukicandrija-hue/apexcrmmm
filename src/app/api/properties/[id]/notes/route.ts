import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    // Update property notes (legacy single field)
    if (body.property_notes !== undefined) {
      try { db.prepare('SELECT notes FROM properties LIMIT 1').get(); } catch { db.exec("ALTER TABLE properties ADD COLUMN notes TEXT DEFAULT ''"); }
      db.prepare("UPDATE properties SET notes = ?, updated_at = datetime('now') WHERE id = ?").run(body.property_notes, id);
    }

    // Update owner notes (legacy single field)
    if (body.owner_notes !== undefined) {
      const property = db.prepare('SELECT owner_id FROM properties WHERE id = ?').get(id) as { owner_id: string } | undefined;
      if (property) {
        db.prepare('UPDATE owners SET notes = ? WHERE id = ?').run(body.owner_notes, property.owner_id);
      }
    }

    // Update next_action_date
    if (body.next_action_date !== undefined) {
      try { db.prepare('SELECT next_action_date FROM properties LIMIT 1').get(); } catch { db.exec('ALTER TABLE properties ADD COLUMN next_action_date TEXT'); }
      db.prepare("UPDATE properties SET next_action_date = ?, updated_at = datetime('now') WHERE id = ?").run(body.next_action_date || null, id);
    }

    return NextResponse.json({ message: 'Sačuvano' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri čuvanju' }, { status: 500 });
  }
}
