import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
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

  const db = getDb();
  let query = `
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name, 
           o.phone as owner_phone, o.email as owner_email
    FROM properties p 
    LEFT JOIN owners o ON p.owner_id = o.id 
    WHERE 1=1
  `;
  const params: string[] = [];

  if (type) { query += ` AND p.type = ?`; params.push(type); }
  if (status) { query += ` AND p.status = ?`; params.push(status); }
  if (search) { query += ` AND (p.title LIKE ? OR p.location LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

  const allowedSorts = ['price', 'area', 'created_at', 'title'];
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

    db.prepare(`
      INSERT INTO properties (id, title, description, location, price, type, area, rooms, status, owner_id, images, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, body.title, body.description || '', body.location, body.price, body.type,
      body.area || null, body.rooms || null, body.status || 'Aktivna',
      body.owner_id, JSON.stringify(body.images || []), body.published ? 1 : 0
    );

    return NextResponse.json({ id, message: 'Nekretnina kreirana' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri kreiranju' }, { status: 500 });
  }
}
