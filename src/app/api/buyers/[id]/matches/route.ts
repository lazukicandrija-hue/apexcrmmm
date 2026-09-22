import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Rooms label -> numeric count mapping
const ROOMS_MAP: Record<string, number> = {
  'Garsonjera': 0.5, 'Jednosoban': 1, 'Dvosoban': 2,
  'Trosoban': 3, 'Četvorosoban': 4, 'Petosoban i više': 5,
};

function parseArr(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as string[];
  try { const p = JSON.parse(val as string); return Array.isArray(p) ? p : []; } catch { return []; }
}

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

  // Parse buyer criteria
  const buyerTypes: string[] = parseArr(buyer.desired_type);
  const buyerRooms: string[] = parseArr(buyer.desired_rooms);
  const buyerLocs: string[] = parseArr(buyer.preferred_locations);
  const buyerBudget = buyer.budget ? Number(buyer.budget) : null;

  const matches = properties.map(prop => {
    let score = 0;
    const reasons: string[] = [];

    // ── TYPE MATCH (required if specified: hard filter) ──────────────────
    const typeOk = buyerTypes.length === 0 || buyerTypes.includes(prop.type as string);
    if (!typeOk) return null; // hard filter — skip immediately
    if (buyerTypes.length > 0) {
      score += 4;
      reasons.push(`Tip: ${prop.type}`);
    }

    // ── BUDGET MATCH ──────────────────────────────────────────────────────
    if (buyerBudget && prop.price) {
      const price = prop.price as number;
      if (buyerBudget >= price) {
        score += 4;
        reasons.push(`U budžetu (€${price.toLocaleString('sr-RS')})`);
      } else if (buyerBudget >= price * 0.9) {
        score += 2;
        reasons.push(`Blizu budžeta (${Math.round((buyerBudget / price) * 100)}%)`);
      } else {
        // More than 10% over budget — hard skip
        return null;
      }
    }

    // ── LOCATION MATCH (preferred_locations takes priority) ──────────────
    if (buyerLocs.length > 0 && prop.location) {
      const propLocLower = (prop.location as string).toLowerCase();
      const locMatch = buyerLocs.some(loc => propLocLower.includes(loc.toLowerCase()) || loc.toLowerCase().includes(propLocLower));
      if (locMatch) {
        score += 3;
        reasons.push(`Lokacija: ${prop.location}`);
      } else {
        // Buyer has specific locations but this property doesn't match — skip
        return null;
      }
    } else if (buyer.location && prop.location) {
      // Fallback: use general location field
      const buyerLocLower = (buyer.location as string).toLowerCase();
      const propLocLower = (prop.location as string).toLowerCase();
      if (propLocLower.includes(buyerLocLower) || buyerLocLower.includes(propLocLower)) {
        score += 2;
        reasons.push(`Lokacija: ${prop.location}`);
      }
    }

    // ── ROOMS MATCH ───────────────────────────────────────────────────────
    if (buyerRooms.length > 0 && prop.rooms != null) {
      const propRooms = Number(prop.rooms);
      // Map desired room labels to numeric ranges
      const roomMatches = buyerRooms.some(r => {
        const n = ROOMS_MAP[r];
        if (n === undefined) return false;
        if (r === 'Petosoban i više') return propRooms >= 5;
        return propRooms === n;
      });
      if (roomMatches) {
        score += 3;
        reasons.push(`${prop.rooms}-soban stan`);
      }
      // Don't hard-filter rooms — they may enter custom values
    }

    return { property: {
      id: prop.id, title: prop.title, location: prop.location,
      price: prop.price, type: prop.type, area: prop.area, rooms: prop.rooms,
      status: prop.status, owner_first_name: prop.owner_first_name, owner_last_name: prop.owner_last_name,
    }, score, reasons };
  })
    .filter((m): m is NonNullable<typeof m> => m !== null && m.score >= 4)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ matches });
}
