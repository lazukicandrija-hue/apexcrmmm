import { NextResponse } from 'next/server';
import { getDb, generatePropertyCode } from '@/lib/db/database';
import { getAuthFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// GET - List properties (supports API key auth)
export async function GET(request: Request) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized — pošalji API ključ kao Bearer token' }, { status: 401 });

  // Check read permission for API keys
  if (auth.apiKey && !auth.apiKey.permissions.includes('read')) {
    return NextResponse.json({ error: 'Nedovoljna ovlašćenja' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const published = searchParams.get('published');

  const db = getDb();
  let query = `
    SELECT p.id, p.title, p.description, p.location, p.price, p.type, p.area, p.rooms,
           p.status, p.published, p.images, p.floor, p.condition, p.parking, p.terrace, p.heating,
           p.cadastral_notes, p.contract_signed, p.street, p.building_number, p.apartment_number,
           p.created_at, p.updated_at,
           o.first_name as owner_first_name, o.last_name as owner_last_name,
           o.phone as owner_phone, o.email as owner_email
    FROM properties p
    LEFT JOIN owners o ON p.owner_id = o.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (type) { query += ` AND p.type = ?`; params.push(type); }
  if (status) { query += ` AND p.status = ?`; params.push(status); }
  if (published !== null && published !== undefined) { query += ` AND p.published = ?`; params.push(parseInt(published)); }

  query += ` ORDER BY p.created_at DESC`;

  const properties = db.prepare(query).all(...params);
  return NextResponse.json({
    count: (properties as unknown[]).length,
    properties,
    auth_type: auth.apiKey ? 'api_key' : 'session',
    bot_name: auth.apiKey?.name || null,
  });
}

// POST - Create a new property (supports API key auth)
export async function POST(request: Request) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized — pošalji API ključ kao Bearer token' }, { status: 401 });

  if (auth.apiKey && !auth.apiKey.permissions.includes('write')) {
    return NextResponse.json({ error: 'Nedovoljna ovlašćenja za pisanje' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // ── Field-level validation with clear error messages ──
    const errors: string[] = [];

    // Required string fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('title: obavezan string (naziv nekretnine, npr. "Stan 52m2 Novo Naselje")');
    } else if (/^\d{6,}$/.test(body.title.trim())) {
      errors.push('title: izgleda kao broj telefona — naslov treba da bude naziv nekretnine, a ne telefon');
    }

    if (!body.location || typeof body.location !== 'string' || body.location.trim().length === 0) {
      errors.push('location: obavezan string (lokacija, npr. "Novo Naselje")');
    }

    if (!body.type || typeof body.type !== 'string') {
      errors.push('type: obavezan — mora biti jedno od: Novogradnja, Sekundarni Stanovi, Rente, Lokali');
    } else if (!['Novogradnja', 'Sekundarni Stanovi', 'Rente', 'Lokali'].includes(body.type)) {
      errors.push(`type: "${body.type}" nije validan — mora biti: Novogradnja, Sekundarni Stanovi, Rente, Lokali`);
    }

    if (!body.owner_id || typeof body.owner_id !== 'string') {
      errors.push('owner_id: obavezan — koristi GET /api/bot/owners da pronađeš vlasnika');
    }

    // Required numeric: price
    if (body.price === undefined || body.price === null || body.price === '') {
      errors.push('price: obavezno polje (cena u evrima, broj, npr. 85000)');
    } else {
      const priceNum = Number(body.price);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.push(`price: "${body.price}" nije validan broj — pošalji broj bez valute, npr. 85000`);
      }
    }

    // Optional numeric: area
    if (body.area !== undefined && body.area !== null && body.area !== '') {
      const areaNum = Number(body.area);
      if (isNaN(areaNum) || areaNum < 0) {
        errors.push(`area: "${body.area}" nije validan broj — pošalji kvadraturu kao broj, npr. 52.5`);
      }
    }

    // Optional numeric: rooms
    if (body.rooms !== undefined && body.rooms !== null && body.rooms !== '') {
      const roomsNum = Number(body.rooms);
      if (isNaN(roomsNum) || roomsNum < 0) {
        errors.push(`rooms: "${body.rooms}" nije validan broj — pošalji broj soba, npr. 2`);
      }
    }

    // Validate status if provided
    if (body.status && !['Aktivna', 'Prodato', 'U pregovoru'].includes(body.status)) {
      errors.push(`status: "${body.status}" nije validan — mora biti: Aktivna, Prodato, U pregovoru`);
    }

    // If there are validation errors, return them all at once
    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Validacija nije prošla',
        validation_errors: errors,
        field_reference: {
          required: {
            title: 'string — naziv nekretnine',
            location: 'string — lokacija/naselje',
            price: 'number — cena u EUR (bez teksta)',
            type: 'enum — Novogradnja | Sekundarni Stanovi | Rente | Lokali',
            owner_id: 'string — UUID vlasnika (GET /api/bot/owners)',
          },
          optional: {
            description: 'string — opis nekretnine',
            area: 'number — kvadratura (m²)',
            rooms: 'number — broj soba',
            status: 'enum — Aktivna | Prodato | U pregovoru (default: Aktivna)',
            published: 'boolean — da li je vidljiva na sajtu (default: false)',
            images: 'string[] — niz URL-ova slika',
            floor: 'string — sprat, npr. "3/5"',
            condition: 'string — stanje, npr. "Novogradnja", "Renoviran"',
            parking: 'string — parking, npr. "Garaža", "Nema"',
            terrace: 'string — terasa, npr. "Da", "Nema"',
            heating: 'string — grejanje, npr. "Centralno", "Etažno"',
            street: 'string — ulica',
            building_number: 'string — broj zgrade',
            apartment_number: 'string — broj stana',
            cadastral_notes: 'string — katastar beleška',
            contract_signed: 'boolean — da li je ugovor potpisan',
          },
        },
      }, { status: 400 });
    }

    // ── Safe numeric conversion ──
    const price = Number(body.price);
    const area = body.area != null && body.area !== '' ? Number(body.area) : null;
    const rooms = body.rooms != null && body.rooms !== '' ? Number(body.rooms) : null;

    // ── Verify owner exists ──
    const db = getDb();
    const ownerExists = db.prepare('SELECT id FROM owners WHERE id = ?').get(body.owner_id);
    if (!ownerExists) {
      return NextResponse.json({
        error: `Vlasnik sa ID "${body.owner_id}" ne postoji`,
        tip: 'Koristi GET /api/bot/owners da pronađeš postojeće vlasnike, ili POST /api/bot/owners da kreiraš novog',
      }, { status: 400 });
    }

    const id = uuidv4();

    // Auto-generate property code
    const code = generatePropertyCode(db, body.type);

    db.prepare(`
      INSERT INTO properties (id, code, title, description, location, price, type, area, rooms, status, owner_id, images, published, floor, condition, parking, terrace, heating, cadastral_notes, contract_signed, street, building_number, apartment_number, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      code,
      body.title.trim(),
      body.description || '',
      body.location.trim(),
      price,
      body.type,
      area,
      rooms,
      body.status || 'Aktivna',
      body.owner_id,
      JSON.stringify(body.images || []),
      body.published ? 1 : 0,
      body.floor || null,
      body.condition || null,
      body.parking || null,
      body.terrace || null,
      body.heating || null,
      body.cadastral_notes || null,
      body.contract_signed ? 1 : 0,
      body.street || null,
      body.building_number || null,
      body.apartment_number || null,
      body.project_id || null
    );

    return NextResponse.json({
      id,
      code,
      message: 'Nekretnina kreirana od strane bota',
      created: {
        code,
        title: body.title.trim(),
        location: body.location.trim(),
        price,
        area,
        rooms,
        type: body.type,
        status: body.status || 'Aktivna',
      },
      published: body.published ? true : false,
      sync_note: body.published ? 'Nekretnina je vidljiva na sajtu' : 'Nekretnina NIJE objavljena na sajtu — postavi published: true da bude vidljiva',
    }, { status: 201 });
  } catch (error) {
    console.error('Bot property creation error:', error);
    return NextResponse.json({
      error: 'Greška pri kreiranju nekretnine',
      tip: 'Proveri da li šalješ validan JSON sa Content-Type: application/json',
    }, { status: 500 });
  }
}
