import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { headers } from 'next/headers';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (id === user.id) return NextResponse.json({ error: 'Ne možete obrisati sopstveni nalog' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return NextResponse.json({ message: 'Korisnik obrisan' });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    if (body.password) {
      db.prepare('UPDATE users SET full_name=?, role=?, password=? WHERE id=?').run(
        body.full_name, body.role || 'agent', hashPassword(body.password), id
      );
    } else {
      db.prepare('UPDATE users SET full_name=?, role=? WHERE id=?').run(body.full_name, body.role || 'agent', id);
    }

    return NextResponse.json({ message: 'Korisnik ažuriran' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}
