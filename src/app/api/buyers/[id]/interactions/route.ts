import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const { note } = await request.json();
    if (!note) return NextResponse.json({ error: 'Napomena je obavezna' }, { status: 400 });

    const db = getDb();
    const interactionId = uuidv4();
    db.prepare(`INSERT INTO buyer_interactions (id, buyer_id, note) VALUES (?, ?, ?)`).run(interactionId, id, note);

    return NextResponse.json({ id: interactionId, message: 'Interakcija dodana' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}
