import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  db.prepare('UPDATE properties SET cadastral_notes = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(body.cadastral_notes || '', id);

  return NextResponse.json({ message: 'Katastar beleška sačuvana ✓' });
}
