import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Map buyer desired_type → property type values
const TYPE_MAP: Record<string, string[]> = {
  'Stan':  ['Sekundarni Stanovi', 'Novogradnja', 'Stan'],
  'Kuća':  ['Kuće', 'Kuća'],
  'Lokal': ['Lokali', 'Lokal'],
  'Plac':  ['Plac', 'Placevi'],
};

// Map desired_rooms label → numeric rooms count (or range)
const ROOMS_MAP: Record<string, number | number[]> = {
  'Garsonjera':     0,
  'Jednosoban':     1,
  'Jednoiposoban':  [1, 2],   // 1 or 2 rooms
  'Dvosoban':       2,
  'Dvoiposoban':    [2, 3],
  'Trosoban':       3,
  'Troiposoban':    [3, 4],
  'Četvorosoban':   4,
  '4+':             -1,       // sentinel: 4 or more
};

function parseArr(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as string[];
  try { const p = JSON.parse(val as string); return Array.isArray(p) ? p : []; } catch { return []; }
}

function roomsMatch(desiredRooms: string[], propRooms: unknown): boolean {
  if (desiredRooms.length === 0) return true; // no preference
  if (propRooms == null || propRooms === '') return false;
  const n = Number(propRooms);
  if (isNaN(n)) return false;
  return desiredRooms.some(r => {
    const mapped = ROOMS_MAP[r];
    if (mapped === undefined) return false;
    if (mapped === -1) return n >= 4;            // '4+'
    if (Array.isArray(mapped)) return mapped.includes(n);
    return n === mapped;
  });
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
  const buyerLocs: string[]  = parseArr(buyer.preferred_locations);
  const buyerBudget = buyer.budget ? Number(buyer.budget) : null;

  // Expand buyer types to all matching property type values
  const expandedTypes: string[] = buyerTypes.length > 0
    ? buyerTypes.flatMap(t => TYPE_MAP[t] ?? [t])
    : [];

  const matches = properties.map(prop => {
    let score = 0;
    const reasons: string[] = [];

    // ── TYPE MATCH (hard filter when buyer has preference) ───────────────
    if (expandedTypes.length > 0) {
      if (!expandedTypes.includes(prop.type as string)) return null;
      score += 4;
      reasons.push(`Tip: ${prop.type}`);
    }

    // ── BUDGET MATCH ──────────────────────────────────────────────────────
    if (buyerBudget && prop.price) {
      const price = prop.price as number;
      if (buyerBudget >= price) {
        score += 4;
        reasons.push(`U budžetu (€${price.toLocaleString('sr-RS')})`);
      } else if (buyerBudget >= price * 0.88) {
        // Within 12% over budget — still show, lower score
        score += 2;
        reasons.push(`Blizu budžeta (${Math.round((buyerBudget / price) * 100)}%)`);
      } else {
        // More than 12% over budget — skip
        return null;
      }
    }

    // ── LOCATION MATCH ────────────────────────────────────────────────────
    if (buyerLocs.length > 0 && prop.location) {
      const propLocLower = (prop.location as string).toLowerCase();
      const locMatch = buyerLocs.some(loc =>
        propLocLower.includes(loc.toLowerCase()) || loc.toLowerCase().includes(propLocLower)
      );
      if (locMatch) {
        score += 3;
        reasons.push(`Lokacija: ${prop.location}`);
      } else {
        // Buyer has specific location preferences — hard skip if not matching
        return null;
      }
    } else if (buyer.location && prop.location) {
      const buyerLocLower = (buyer.location as string).toLowerCase();
      const propLocLower  = (prop.location as string).toLowerCase();
      if (propLocLower.includes(buyerLocLower) || buyerLocLower.includes(propLocLower)) {
        score += 2;
        reasons.push(`Lokacija: ${prop.location}`);
      }
    }

    // ── ROOMS MATCH (soft — adds score) ──────────────────────────────────
    if (buyerRooms.length > 0) {
      if (roomsMatch(buyerRooms, prop.rooms)) {
        score += 3;
        reasons.push(`${prop.rooms}-soban`);
      }
      // Don't hard-filter rooms — just reward matches
    }

    // Must have at least one meaningful signal (type or location or budget)
    if (score < 4) return null;

    return {
      property: {
        id: prop.id, title: prop.title, location: prop.location,
        price: prop.price, type: prop.type, area: prop.area, rooms: prop.rooms,
        status: prop.status,
        owner_first_name: prop.owner_first_name,
        owner_last_name: prop.owner_last_name,
      },
      score,
      reasons,
    };
  })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ matches });
}
