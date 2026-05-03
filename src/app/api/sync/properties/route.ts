import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

// Public endpoint - no auth needed (for website integration)
export async function GET() {
  const db = getDb();
  const properties = db.prepare(`
    SELECT p.id, p.title, p.description, p.location, p.price, p.type, p.area, p.rooms,
           p.status, p.images, p.created_at,
           o.first_name as owner_first_name, o.last_name as owner_last_name
    FROM properties p LEFT JOIN owners o ON p.owner_id = o.id
    WHERE p.published = 1 AND p.status = 'Aktivna'
    ORDER BY p.created_at DESC
  `).all();

  const formatted = (properties as Record<string, unknown>[]).map(p => ({
    ...p,
    images: JSON.parse((p.images as string) || '[]'),
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
