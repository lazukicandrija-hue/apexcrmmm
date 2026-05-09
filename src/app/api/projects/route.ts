import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { getAuthFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// GET - List all projects
export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  const auth = getAuthFromRequest(headersList);
  if (!user && !auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM properties pr WHERE pr.project_id = p.id) as unit_count,
      (SELECT COUNT(*) FROM properties pr WHERE pr.project_id = p.id AND pr.status = 'Prodato') as sold_count
    FROM projects p ORDER BY p.created_at DESC
  `).all();

  return NextResponse.json({ projects });
}

// POST - Create a new project
export async function POST(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.name || !body.location) {
      return NextResponse.json({ error: 'Nedostaju obavezna polja: name, location' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO projects (id, name, location, description, developer, total_units, images)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, body.name, body.location,
      body.description || '', body.developer || '',
      body.total_units || null, JSON.stringify(body.images || [])
    );

    return NextResponse.json({ id, message: 'Projekat kreiran' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri kreiranju projekta' }, { status: 500 });
  }
}
