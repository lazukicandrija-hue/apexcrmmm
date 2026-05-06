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
  const property = db.prepare(`
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name,
           o.phone as owner_phone, o.email as owner_email, o.notes as owner_notes
    FROM properties p LEFT JOIN owners o ON p.owner_id = o.id WHERE p.id = ?
  `).get(id);

  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ property });
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
      UPDATE properties SET title=?, description=?, location=?, price=?, type=?, area=?, rooms=?,
      status=?, owner_id=?, images=?, published=?, floor=?, condition=?, parking=?, terrace=?, heating=?,
      cadastral_notes=?, contract_signed=?,
      updated_at=datetime('now') WHERE id=?
    `).run(
      body.title, body.description || '', body.location, body.price, body.type,
      body.area || null, body.rooms || null, body.status || 'Aktivna',
      body.owner_id, JSON.stringify(body.images || []), body.published ? 1 : 0,
      body.floor || null, body.condition || null, body.parking || null,
      body.terrace || null, body.heating || null,
      body.cadastral_notes || null, body.contract_signed ? 1 : 0, id
    );

    return NextResponse.json({ message: 'Nekretnina ažurirana' });
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
  db.prepare('DELETE FROM properties WHERE id = ?').run(id);
  return NextResponse.json({ message: 'Nekretnina obrisana' });
}
