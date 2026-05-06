import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getAuthFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// GET - List owners (so the bot can look up owner_id)
export async function GET(request: Request) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');

  const db = getDb();
  let query = 'SELECT id, first_name, last_name, phone, email FROM owners WHERE 1=1';
  const params: string[] = [];

  if (search) {
    query += ` AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY last_name ASC';
  const owners = db.prepare(query).all(...params);

  return NextResponse.json({ count: (owners as unknown[]).length, owners });
}

// POST - Create a new owner
export async function POST(request: Request) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.apiKey && !auth.apiKey.permissions.includes('write')) {
    return NextResponse.json({ error: 'Nedovoljna ovlašćenja' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.first_name || !body.last_name) {
      return NextResponse.json({
        error: 'Nedostaju obavezna polja',
        required: ['first_name', 'last_name'],
        optional: ['phone', 'email', 'notes'],
      }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO owners (id, first_name, last_name, phone, email, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, body.first_name, body.last_name, body.phone || '', body.email || '', body.notes || '');

    return NextResponse.json({
      id,
      message: `Vlasnik ${body.first_name} ${body.last_name} kreiran`,
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri kreiranju vlasnika' }, { status: 500 });
  }
}
