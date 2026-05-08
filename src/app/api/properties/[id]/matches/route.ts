import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Find buyers that match this property
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buyers = db.prepare(
    "SELECT * FROM buyers WHERE status = 'Aktivan' ORDER BY created_at DESC"
  ).all() as Record<string, unknown>[];

  const matches = buyers.map(buyer => {
    let score = 0;
    const reasons: string[] = [];

    // Type match
    if (buyer.desired_type && buyer.desired_type === property.type) {
      score += 3;
      reasons.push(`Tip: ${property.type}`);
    }

    // Budget match (buyer budget >= property price)
    if (buyer.budget && property.price && (buyer.budget as number) >= (property.price as number)) {
      score += 3;
      reasons.push(`Budžet: €${(buyer.budget as number).toLocaleString()} ≥ €${(property.price as number).toLocaleString()}`);
    } else if (buyer.budget && property.price && (buyer.budget as number) >= (property.price as number) * 0.85) {
      score += 1;
      reasons.push(`Budžet blizu (${Math.round(((buyer.budget as number) / (property.price as number)) * 100)}%)`);
    }

    // Location match (partial)
    if (buyer.location && property.location) {
      const buyerLoc = (buyer.location as string).toLowerCase();
      const propLoc = (property.location as string).toLowerCase();
      if (propLoc.includes(buyerLoc) || buyerLoc.includes(propLoc)) {
        score += 2;
        reasons.push(`Lokacija: ${property.location}`);
      }
    }

    return {
      buyer: {
        id: buyer.id,
        first_name: buyer.first_name,
        last_name: buyer.last_name,
        phone: buyer.phone,
        desired_type: buyer.desired_type,
        location: buyer.location,
        budget: buyer.budget,
        status: buyer.status,
      },
      score,
      reasons,
    };
  }).filter(m => m.score >= 2).sort((a, b) => b.score - a.score);

  return NextResponse.json({ matches });
}
