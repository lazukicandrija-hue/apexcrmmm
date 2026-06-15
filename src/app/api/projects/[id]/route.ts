import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// GET - Single project with its units
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return NextResponse.json({ error: 'Projekat nije pronađen' }, { status: 404 });

  const units = db.prepare(`
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name
    FROM properties p LEFT JOIN owners o ON p.owner_id = o.id
    WHERE p.project_id = ? ORDER BY p.code ASC
  `).all(id);

  return NextResponse.json({ project, units });
}

// PUT - Update project
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: 'Projekat nije pronađen' }, { status: 404 });

    db.prepare(`
      UPDATE projects SET name=?, location=?, description=?, developer=?, total_units=?, images=?, website_description=?, completion_date=?
      WHERE id=?
    `).run(
      body.name ?? existing.name,
      body.location ?? existing.location,
      body.description ?? existing.description,
      body.developer ?? existing.developer,
      body.total_units ?? existing.total_units,
      body.images ? JSON.stringify(body.images) : (existing.images as string),
      body.website_description ?? (existing.website_description as string) ?? '',
      body.completion_date ?? (existing.completion_date as string) ?? '',
      id
    );

    return NextResponse.json({ message: 'Projekat ažuriran' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}

// DELETE - Delete project (unlinks properties, doesn't delete them)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Unlink properties from this project
  db.prepare('UPDATE properties SET project_id = NULL WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);

  return NextResponse.json({ message: 'Projekat obrisan' });
}
