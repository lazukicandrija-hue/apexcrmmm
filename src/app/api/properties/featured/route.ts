import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';

// GET - list all featured properties in order
export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const featured = db.prepare(`
    SELECT p.id, p.code, p.title, p.location, p.price, p.type, p.area, p.rooms,
           p.featured_order, p.published, p.images
    FROM properties p
    WHERE p.featured_order IS NOT NULL
    ORDER BY p.featured_order ASC
  `).all();

  return NextResponse.json({ featured });
}

// PUT - bulk reorder featured properties
// Body: { order: ["id1", "id2", "id3"] } — array of property IDs in desired order
export async function PUT(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const order: string[] = body.order;
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'order mora biti niz ID-jeva nekretnina' }, { status: 400 });
    }

    const db = getDb();
    const update = db.prepare('UPDATE properties SET featured_order = ?, updated_at = datetime(\'now\') WHERE id = ?');
    
    const txn = db.transaction(() => {
      for (let i = 0; i < order.length; i++) {
        update.run(i + 1, order[i]);
      }
    });
    txn();

    return NextResponse.json({ message: `Redosled ažuriran za ${order.length} nekretnina`, count: order.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri ažuriranju redosleda' }, { status: 500 });
  }
}
