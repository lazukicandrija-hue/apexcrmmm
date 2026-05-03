import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// GET /api/notes?entity_type=property&entity_id=xxx
export async function GET(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const db = getDb();
  const notes = db.prepare(
    'SELECT * FROM notes_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC'
  ).all(entityType, entityId);

  return NextResponse.json({ notes });
}

// POST /api/notes — add a new note
export async function POST(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { entity_type, entity_id, content } = body;

    if (!entity_type || !entity_id || !content?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(
      'INSERT INTO notes_history (id, entity_type, entity_id, content) VALUES (?, ?, ?, ?)'
    ).run(id, entity_type, entity_id, content.trim());

    const note = db.prepare('SELECT * FROM notes_history WHERE id = ?').get(id);
    return NextResponse.json({ note, message: 'Beleška dodana' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}
