import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(id);
  if (!owner) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ owner });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();
    db.prepare(`
      UPDATE owners SET first_name=?, last_name=?, phone=?, email=?, notes=? WHERE id=?
    `).run(body.first_name, body.last_name, body.phone || '', body.email || '', body.notes || '', id);
    return NextResponse.json({ message: 'Vlasnik ažuriran' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM owners WHERE id = ?').run(id);
  return NextResponse.json({ message: 'Vlasnik obrisan' });
}
