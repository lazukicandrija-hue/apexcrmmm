import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const users = db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at DESC').all();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.username || !body.password || !body.full_name) {
      return NextResponse.json({ error: 'Sva polja su obavezna' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(body.username);
    if (existing) return NextResponse.json({ error: 'Korisničko ime već postoji' }, { status: 409 });

    const id = uuidv4();
    db.prepare(`INSERT INTO users (id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?)`).run(
      id, body.username, hashPassword(body.password), body.full_name, body.role || 'agent'
    );

    return NextResponse.json({ id, message: 'Korisnik kreiran' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}
