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
  const search = searchParams.get('search');

  const db = getDb();
  let query = 'SELECT * FROM owners WHERE 1=1';
  const params: string[] = [];

  if (search) {
    query += ` AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY created_at DESC';

  const owners = db.prepare(query).all(...params);
  return NextResponse.json({ owners });
}

export async function POST(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO owners (id, first_name, last_name, phone, email, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, body.first_name, body.last_name, body.phone || '', body.email || '', body.notes || '');

    return NextResponse.json({ id, message: 'Vlasnik kreiran' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri kreiranju' }, { status: 500 });
  }
}
