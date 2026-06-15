import { NextResponse } from 'next/server';
import { getDb, generatePropertyCode } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'DESC';
  // Advanced filters
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const minRooms = searchParams.get('minRooms');
  const maxRooms = searchParams.get('maxRooms');
  const minArea = searchParams.get('minArea');
  const maxArea = searchParams.get('maxArea');
  const floor = searchParams.get('floor');
  const parking = searchParams.get('parking');
  const heating = searchParams.get('heating');
  const terrace = searchParams.get('terrace');
  const condition = searchParams.get('condition');
  const owner = searchParams.get('owner');

  const db = getDb();
  let query = `
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name, 
           o.phone as owner_phone, o.email as owner_email
    FROM properties p 
    LEFT JOIN owners o ON p.owner_id = o.id 
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (type) { query += ` AND p.type = ?`; params.push(type); }
  if (status) { query += ` AND p.status = ?`; params.push(status); }
  if (search) {
    query += ` AND (p.title LIKE ? OR p.location LIKE ? OR p.description LIKE ? OR (o.first_name || ' ' || o.last_name) LIKE ? OR p.street LIKE ? OR p.building_number LIKE ? OR p.apartment_number LIKE ? OR p.code LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (minPrice) { query += ` AND p.price >= ?`; params.push(Number(minPrice)); }
  if (maxPrice) { query += ` AND p.price <= ?`; params.push(Number(maxPrice)); }
  if (minRooms) { query += ` AND p.rooms >= ?`; params.push(Number(minRooms)); }
  if (maxRooms) { query += ` AND p.rooms <= ?`; params.push(Number(maxRooms)); }
  if (minArea) { query += ` AND p.area >= ?`; params.push(Number(minArea)); }
  if (maxArea) { query += ` AND p.area <= ?`; params.push(Number(maxArea)); }
  if (floor) { query += ` AND p.floor LIKE ?`; params.push(`%${floor}%`); }
  if (parking) { query += ` AND p.parking = ?`; params.push(parking); }
  if (heating) { query += ` AND p.heating = ?`; params.push(heating); }
  if (terrace) { query += ` AND p.terrace = ?`; params.push(terrace); }
  if (condition) { query += ` AND p.condition = ?`; params.push(condition); }
  if (owner) {
    query += ` AND (o.first_name LIKE ? OR o.last_name LIKE ? OR (o.first_name || ' ' || o.last_name) LIKE ?)`;
    params.push(`%${owner}%`, `%${owner}%`, `%${owner}%`);
  }
  const location = searchParams.get('location');
  if (location) { query += ` AND p.location = ?`; params.push(location); }

  const allowedSorts = ['price', 'area', 'created_at', 'title', 'rooms'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
  query += ` ORDER BY p.${sortCol} ${sortOrder}`;

  const properties = db.prepare(query).all(...params);
  return NextResponse.json({ properties });
}

export async function POST(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const db = getDb();
    const id = uuidv4();

    const price = body.price != null ? Number(body.price) : 0;
    const area = body.area != null && body.area !== '' ? Number(body.area) : null;
    const rooms = body.rooms != null && body.rooms !== '' ? Number(body.rooms) : null;

    // Auto-generate property code
    const code = generatePropertyCode(db, body.type);

    db.prepare(`
      INSERT INTO properties (id, code, title, description, location, price, type, area, rooms, status, owner_id, images, published, floor, condition, parking, terrace, heating, cadastral_notes, contract_signed, street, building_number, apartment_number, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, code, body.title, body.description || '', body.location, price, body.type,
      area, rooms, body.status || 'Aktivna',
      body.owner_id || '__none__', JSON.stringify(body.images || []), body.published ? 1 : 0,
      body.floor || null, body.condition || null, body.parking || null,
      body.terrace || null, body.heating || null,
      body.cadastral_notes || null, body.contract_signed ? 1 : 0,
      body.street || null, body.building_number || null, body.apartment_number || null,
      body.project_id || null
    );

    return NextResponse.json({ id, code, message: 'Nekretnina kreirana' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri kreiranju' }, { status: 500 });
  }
}
