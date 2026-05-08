import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    db.prepare('UPDATE properties SET images = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(body.images || []), id);

    return NextResponse.json({ images: body.images, message: 'Redosled slika sačuvan' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}
