import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';

// Toggle or set featured_order for a property
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const property = db.prepare('SELECT id, title, featured_order, published FROM properties WHERE id = ?').get(id) as { id: string; title: string; featured_order: number | null; published: number } | undefined;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { featured_order?: number | null } = {};
  try {
    body = await request.json();
  } catch {
    // toggle mode — no body means toggle on/off
  }

  if (body.featured_order !== undefined) {
    // Explicit set
    const order = body.featured_order;
    db.prepare('UPDATE properties SET featured_order = ?, updated_at = datetime(\'now\') WHERE id = ?').run(order, id);
    return NextResponse.json({ 
      featured: order !== null, 
      featured_order: order,
      message: order !== null ? `Nekretnina "${property.title}" istaknuta na poziciji ${order}` : `Nekretnina "${property.title}" uklonjena sa istaknutih`
    });
  } else {
    // Toggle: if featured, un-feature; if not, add to end
    if (property.featured_order !== null) {
      db.prepare('UPDATE properties SET featured_order = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(id);
      return NextResponse.json({ featured: false, featured_order: null, message: `Nekretnina "${property.title}" uklonjena sa istaknutih` });
    } else {
      // Get the max featured_order and add 1
      const maxRow = db.prepare('SELECT MAX(featured_order) as max_order FROM properties WHERE featured_order IS NOT NULL').get() as { max_order: number | null };
      const newOrder = (maxRow?.max_order ?? 0) + 1;
      db.prepare('UPDATE properties SET featured_order = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newOrder, id);
      return NextResponse.json({ featured: true, featured_order: newOrder, message: `Nekretnina "${property.title}" istaknuta na sajtu` });
    }
  }
}
