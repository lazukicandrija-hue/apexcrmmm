import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getAuthFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';

// GET single property / PUT update / DELETE
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const property = db.prepare(`
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name,
           o.phone as owner_phone, o.email as owner_email
    FROM properties p LEFT JOIN owners o ON p.owner_id = o.id WHERE p.id = ?
  `).get(id);

  if (!property) return NextResponse.json({ error: 'Nekretnina nije pronađena' }, { status: 404 });
  return NextResponse.json({ property });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.apiKey && !auth.apiKey.permissions.includes('write')) {
    return NextResponse.json({ error: 'Nedovoljna ovlašćenja za pisanje' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    // Partial update support — only update fields that are provided
    const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: 'Nekretnina nije pronađena' }, { status: 404 });

    const updated = {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      location: body.location ?? existing.location,
      price: body.price ?? existing.price,
      type: body.type ?? existing.type,
      area: body.area ?? existing.area,
      rooms: body.rooms ?? existing.rooms,
      status: body.status ?? existing.status,
      owner_id: body.owner_id ?? existing.owner_id,
      images: body.images ? JSON.stringify(body.images) : (existing.images as string),
      published: body.published !== undefined ? (body.published ? 1 : 0) : existing.published,
      floor: body.floor ?? existing.floor,
      condition: body.condition ?? existing.condition,
      parking: body.parking ?? existing.parking,
      terrace: body.terrace ?? existing.terrace,
      heating: body.heating ?? existing.heating,
    };

    db.prepare(`
      UPDATE properties SET title=?, description=?, location=?, price=?, type=?, area=?, rooms=?,
      status=?, owner_id=?, images=?, published=?, floor=?, condition=?, parking=?, terrace=?, heating=?,
      updated_at=datetime('now') WHERE id=?
    `).run(
      updated.title, updated.description, updated.location, updated.price, updated.type,
      updated.area, updated.rooms, updated.status, updated.owner_id, updated.images,
      updated.published, updated.floor, updated.condition, updated.parking,
      updated.terrace, updated.heating, id
    );

    return NextResponse.json({ message: 'Nekretnina ažurirana', id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}
