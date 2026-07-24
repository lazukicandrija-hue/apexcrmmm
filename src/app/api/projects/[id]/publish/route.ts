import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const project = db.prepare('SELECT published, name, images FROM projects WHERE id = ?').get(id) as { published: number; name: string; images: string } | undefined;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus = project.published ? 0 : 1;
  db.prepare('UPDATE projects SET published = ? WHERE id = ?').run(newStatus, id);

  // When publishing a project, also publish ALL its units (active + sold)
  if (newStatus === 1) {
    db.prepare(`
      UPDATE properties SET published = 1, updated_at = datetime('now')
      WHERE project_id = ?
    `).run(id);
  }

  return NextResponse.json({ 
    published: !!newStatus, 
    message: newStatus ? `Projekat "${project.name}" objavljen na sajtu ✓` : `Projekat "${project.name}" uklonjen sa sajta` 
  });
}
