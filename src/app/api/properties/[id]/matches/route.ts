import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Map buyer desired_type → property type values (same as buyer matches)
const TYPE_MAP: Record<string, string[]> = {
  'Stan':  ['Sekundarni Stanovi', 'Novogradnja', 'Stan'],
  'Kuća':  ['Kuće', 'Kuća'],
  'Lokal': ['Lokali', 'Lokal'],
  'Plac':  ['Plac', 'Placevi'],
};

// Map desired_rooms label → numeric rooms count
const ROOMS_MAP: Record<string, number | number[]> = {
  'Garsonjera':    0,
  'Jednosoban':    1,
  'Jednoiposoban': [1, 2],
  'Dvosoban':      2,
  'Dvoiposoban':   [2, 3],
  'Trosoban':      3,
  'Troiposoban':   [3, 4],
  'Četvorosoban':  4,
  '4+':            -1,
};

function parseArr(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as string[];
  try { const p = JSON.parse(val as string); return Array.isArray(p) ? p : []; } catch { return []; }
}

function roomsMatch(desiredRooms: string[], propRooms: unknown): boolean {
  if (desiredRooms.length === 0) return true;
  if (propRooms == null || propRooms === '') return false;
  const n = Number(propRooms);
  if (isNaN(n)) return false;
  return desiredRooms.some(r => {
    const mapped = ROOMS_MAP[r];
    if (mapped === undefined) return false;
    if (mapped === -1) return n >= 4;
    if (Array.isArray(mapped)) return mapped.includes(n);
    return n === mapped;
  });
}

// Find buyers that match this property
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const propType     = property.type as string;
  const propPrice    = property.price ? Number(property.price) : null;
  const propLocation = property.location ? (property.location as string).toLowerCase() : '';
  const propRooms    = property.rooms;

  const buyers = db.prepare(
    "SELECT * FROM buyers WHERE status = 'Aktivan' ORDER BY created_at DESC"
  ).all() as Record<string, unknown>[];

  const matches = buyers.map(buyer => {
    let score = 0;
    const reasons: string[] = [];

    // ── TYPE MATCH ────────────────────────────────────────────────────────
    const buyerTypes: string[] = parseArr(buyer.desired_type);
    if (buyerTypes.length > 0) {
      // Expand buyer type labels to property type values
      const expandedTypes = buyerTypes.flatMap(t => TYPE_MAP[t] ?? [t]);
      if (!expandedTypes.includes(propType)) return null; // hard filter
      score += 4;
      reasons.push(`Tip: ${propType}`);
    }

    // ── BUDGET MATCH ──────────────────────────────────────────────────────
    if (buyer.budget && propPrice) {
      const buyerBudget = Number(buyer.budget);
      if (buyerBudget >= propPrice) {
        score += 4;
        reasons.push(`U budžetu (€${buyerBudget.toLocaleString('sr-RS')} ≥ €${propPrice.toLocaleString('sr-RS')})`);
      } else if (buyerBudget >= propPrice * 0.88) {
        score += 2;
        reasons.push(`Blizu budžeta (${Math.round((buyerBudget / propPrice) * 100)}%)`);
      } else {
        return null; // too expensive for buyer
      }
    }

    // ── LOCATION MATCH ────────────────────────────────────────────────────
    const buyerLocs: string[] = parseArr(buyer.preferred_locations);
    if (buyerLocs.length > 0) {
      // Buyer has specific preferred locations — check if property matches any
      const locMatch = buyerLocs.some(loc =>
        propLocation.includes(loc.toLowerCase()) || loc.toLowerCase().includes(propLocation)
      );
      if (locMatch) {
        score += 3;
        reasons.push(`Lokacija: ${property.location}`);
      } else {
        return null; // property not in buyer's preferred areas
      }
    } else if (buyer.location) {
      // Fallback: buyer has a general location field
      const buyerLocLower = (buyer.location as string).toLowerCase();
      if (propLocation.includes(buyerLocLower) || buyerLocLower.includes(propLocation)) {
        score += 2;
        reasons.push(`Lokacija: ${property.location}`);
      }
    }

    // ── ROOMS MATCH (soft) ────────────────────────────────────────────────
    const buyerRooms: string[] = parseArr(buyer.desired_rooms);
    if (buyerRooms.length > 0 && roomsMatch(buyerRooms, propRooms)) {
      score += 3;
      reasons.push(`${propRooms}-soban`);
    }

    if (score < 4) return null;

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
  })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ matches });
}
