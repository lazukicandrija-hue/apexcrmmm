import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
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
           p.created_at, p.updated_at,
           o.first_name as owner_first_name, o.last_name as owner_last_name
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

    // Validate required fields
    if (!body.title || !body.location || body.price === undefined || !body.type || !body.owner_id) {
      return NextResponse.json({
        error: 'Nedostaju obavezna polja',
        required: ['title', 'location', 'price', 'type', 'owner_id'],
        tip: 'Ako ne znaš owner_id, koristi GET /api/bot/owners da pronađeš vlasnika',
      }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO properties (id, title, description, location, price, type, area, rooms, status, owner_id, images, published, floor, condition, parking, terrace, heating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, body.title, body.description || '', body.location, body.price, body.type,
      body.area || null, body.rooms || null, body.status || 'Aktivna',
      body.owner_id, JSON.stringify(body.images || []), body.published ? 1 : 0,
      body.floor || null, body.condition || null, body.parking || null,
      body.terrace || null, body.heating || null
    );

    return NextResponse.json({
      id,
      message: 'Nekretnina kreirana od strane bota',
      published: body.published ? true : false,
      sync_note: body.published ? 'Nekretnina je vidljiva na sajtu' : 'Nekretnina NIJE objavljena na sajtu — postavi published: true da bude vidljiva',
    }, { status: 201 });
  } catch (error) {
    console.error('Bot property creation error:', error);
    return NextResponse.json({ error: 'Greška pri kreiranju nekretnine' }, { status: 500 });
  }
}
