import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Find properties that match this buyer's criteria
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const buyer = db.prepare('SELECT * FROM buyers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!buyer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const properties = db.prepare(
    "SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name FROM properties p LEFT JOIN owners o ON p.owner_id = o.id WHERE p.status = 'Aktivna' ORDER BY p.created_at DESC"
  ).all() as Record<string, unknown>[];

  const matches = properties.map(prop => {
    let score = 0;
    const reasons: string[] = [];

    // Type match
    if (buyer.desired_type && buyer.desired_type === prop.type) {
      score += 3;
      reasons.push(`Tip: ${prop.type}`);
    }

    // Budget match
    if (buyer.budget && prop.price && (buyer.budget as number) >= (prop.price as number)) {
      score += 3;
      reasons.push(`U budžetu (€${(prop.price as number).toLocaleString()})`);
    } else if (buyer.budget && prop.price && (buyer.budget as number) >= (prop.price as number) * 0.85) {
      score += 1;
      reasons.push(`Blizu budžeta (${Math.round(((buyer.budget as number) / (prop.price as number)) * 100)}%)`);
    }

    // Location match
    if (buyer.location && prop.location) {
      const buyerLoc = (buyer.location as string).toLowerCase();
      const propLoc = (prop.location as string).toLowerCase();
      if (propLoc.includes(buyerLoc) || buyerLoc.includes(propLoc)) {
        score += 2;
        reasons.push(`Lokacija: ${prop.location}`);
      }
    }

    return {
      property: {
        id: prop.id,
        title: prop.title,
        location: prop.location,
        price: prop.price,
        type: prop.type,
        area: prop.area,
        rooms: prop.rooms,
        status: prop.status,
        owner_first_name: prop.owner_first_name,
        owner_last_name: prop.owner_last_name,
      },
      score,
      reasons,
    };
  }).filter(m => m.score >= 2).sort((a, b) => b.score - a.score);

  return NextResponse.json({ matches });
}
