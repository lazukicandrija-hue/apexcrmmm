import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const search = searchParams.get('search');

  const db = getDb();
  let query = 'SELECT * FROM buyers WHERE 1=1';
  const params: string[] = [];

  if (status) { query += ` AND status = ?`; params.push(status); }
  if (type) { query += ` AND desired_type = ?`; params.push(type); }
  if (search) {
    query += ` AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY next_action_date ASC NULLS LAST';

  const buyers = db.prepare(query).all(...params);
  return NextResponse.json({ buyers });
}

export async function POST(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Sesija istekla — ulogujte se ponovo' }, { status: 401 });

  try {
    const body = await request.json();
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO buyers (id, first_name, last_name, phone, email, desired_type, location, budget, notes, next_action_date, status, financing, desired_rooms, preferred_locations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, body.first_name, body.last_name, body.phone || '', body.email || '',
      body.desired_type || '', body.location || '', body.budget || null,
      body.notes || '', body.next_action_date || null, body.status || 'Novo',
      body.financing || '', body.desired_rooms || '',
      body.preferred_locations ? JSON.stringify(body.preferred_locations) : ''
    );

    if (body.notes) {
      db.prepare(`INSERT INTO buyer_interactions (id, buyer_id, note) VALUES (?, ?, ?)`).run(
        uuidv4(), id, `Inicijalni kontakt: ${body.notes}`
      );
    }

    return NextResponse.json({ id, message: 'Kupac kreiran' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri kreiranju' }, { status: 500 });
  }
}
