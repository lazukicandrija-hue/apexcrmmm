import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const property = db.prepare('SELECT published FROM properties WHERE id = ?').get(id) as { published: number } | undefined;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus = property.published ? 0 : 1;
  db.prepare('UPDATE properties SET published = ? WHERE id = ?').run(newStatus, id);

  return NextResponse.json({ published: !!newStatus, message: newStatus ? 'Objavljeno na sajtu' : 'Uklonjeno sa sajta' });
}
