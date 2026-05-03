import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

// Public endpoint - no auth needed (for website integration)
// ONLY exposes safe, public-facing property data
export async function GET() {
  const db = getDb();
  const properties = db.prepare(`
    SELECT p.id, p.title, p.description, p.location, p.price, p.type, p.area, p.rooms,
           p.images, p.created_at
    FROM properties p
    WHERE p.published = 1 AND p.status = 'Aktivna'
    ORDER BY p.created_at DESC
  `).all();

  const formatted = (properties as Record<string, unknown>[]).map(p => ({
    id: p.id,
    title: p.title,
    description: p.description,
    location: p.location,
    price: p.price,
    type: p.type,
    area: p.area,
    rooms: p.rooms,
    images: JSON.parse((p.images as string) || '[]'),
    created_at: p.created_at,
  }));

  return NextResponse.json({
    count: formatted.length,
    updated_at: new Date().toISOString(),
    properties: formatted,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
