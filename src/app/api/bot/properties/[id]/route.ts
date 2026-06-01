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

    // ── Validate fields that are provided ──
    const errors: string[] = [];

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        errors.push('title: mora biti neprazan string');
      } else if (/^\d{6,}$/.test(body.title.trim())) {
        errors.push('title: izgleda kao broj telefona — naslov treba da bude naziv nekretnine');
      }
    }

    if (body.location !== undefined && (typeof body.location !== 'string' || body.location.trim().length === 0)) {
      errors.push('location: mora biti neprazan string');
    }

    if (body.type !== undefined && !['Novogradnja', 'Sekundarni Stanovi', 'Rente', 'Lokali'].includes(body.type)) {
      errors.push(`type: "${body.type}" nije validan — mora biti: Novogradnja, Sekundarni Stanovi, Rente, Lokali`);
    }

    if (body.status !== undefined && !['Aktivna', 'Prodato', 'U pregovoru'].includes(body.status)) {
      errors.push(`status: "${body.status}" nije validan — mora biti: Aktivna, Prodato, U pregovoru`);
    }

    if (body.price !== undefined && body.price !== null) {
      const priceNum = Number(body.price);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.push(`price: "${body.price}" nije validan broj`);
      }
    }

    if (body.area !== undefined && body.area !== null && body.area !== '') {
      const areaNum = Number(body.area);
      if (isNaN(areaNum) || areaNum < 0) {
        errors.push(`area: "${body.area}" nije validan broj`);
      }
    }

    if (body.rooms !== undefined && body.rooms !== null && body.rooms !== '') {
      const roomsNum = Number(body.rooms);
      if (isNaN(roomsNum) || roomsNum < 0) {
        errors.push(`rooms: "${body.rooms}" nije validan broj`);
      }
    }

    if (body.owner_id !== undefined) {
      const ownerExists = db.prepare('SELECT id FROM owners WHERE id = ?').get(body.owner_id);
      if (!ownerExists) {
        errors.push(`owner_id: vlasnik "${body.owner_id}" ne postoji`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Validacija nije prošla',
        validation_errors: errors,
      }, { status: 400 });
    }

    const updated = {
      title: body.title !== undefined ? body.title.trim() : existing.title,
      description: body.description ?? existing.description,
      location: body.location !== undefined ? body.location.trim() : existing.location,
      price: body.price != null ? Number(body.price) : existing.price,
      type: body.type ?? existing.type,
      area: body.area != null && body.area !== '' ? Number(body.area) : existing.area,
      rooms: body.rooms != null && body.rooms !== '' ? Number(body.rooms) : existing.rooms,
      status: body.status ?? existing.status,
      owner_id: body.owner_id ?? existing.owner_id,
      images: body.images ? JSON.stringify(body.images) : (existing.images as string),
      published: body.published !== undefined ? (body.published ? 1 : 0) : existing.published,
      floor: body.floor ?? existing.floor,
      condition: body.condition ?? existing.condition,
      parking: body.parking ?? existing.parking,
      terrace: body.terrace ?? existing.terrace,
      heating: body.heating ?? existing.heating,
      street: body.street ?? existing.street,
      building_number: body.building_number ?? existing.building_number,
      apartment_number: body.apartment_number ?? existing.apartment_number,
      cadastral_notes: body.cadastral_notes ?? existing.cadastral_notes,
      contract_signed: body.contract_signed !== undefined ? (body.contract_signed ? 1 : 0) : existing.contract_signed,
    };

    db.prepare(`
      UPDATE properties SET title=?, description=?, location=?, price=?, type=?, area=?, rooms=?,
      status=?, owner_id=?, images=?, published=?, floor=?, condition=?, parking=?, terrace=?, heating=?,
      street=?, building_number=?, apartment_number=?, cadastral_notes=?, contract_signed=?,
      updated_at=datetime('now') WHERE id=?
    `).run(
      updated.title, updated.description, updated.location, updated.price, updated.type,
      updated.area, updated.rooms, updated.status, updated.owner_id, updated.images,
      updated.published, updated.floor, updated.condition, updated.parking,
      updated.terrace, updated.heating,
      updated.street, updated.building_number, updated.apartment_number,
      updated.cadastral_notes, updated.contract_signed,
      id
    );

    return NextResponse.json({ message: 'Nekretnina ažurirana', id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}
