import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// DELETE - Revoke/deactivate an API key
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare('UPDATE api_keys SET active = 0 WHERE id = ?').run(id);

  return NextResponse.json({ message: 'API ključ deaktiviran' });
}

// PUT - Toggle active status
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  if (typeof body.active === 'number' || typeof body.active === 'boolean') {
    db.prepare('UPDATE api_keys SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
  }

  if (body.name) {
    db.prepare('UPDATE api_keys SET name = ? WHERE id = ?').run(body.name, id);
  }

  return NextResponse.json({ message: 'API ključ ažuriran' });
}
