import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

// Public endpoint - no auth needed (for website integration)
// ONLY exposes safe, public-facing property data
const CRM_BASE = 'https://crm.apexrealestate.rs';
export async function GET() {
  const db = getDb();
  const properties = db.prepare(`
    SELECT p.id, p.title, p.description, p.website_description, p.location, p.price, p.type, p.area, p.rooms,
           p.images, p.created_at, p.floor, p.condition, p.parking, p.terrace, p.heating
    FROM properties p
    WHERE p.published = 1 AND p.status = 'Aktivna'
    ORDER BY p.created_at DESC
  `).all();

  const formatted = (properties as Record<string, unknown>[]).map(p => ({
    id: p.id,
    title: p.title,
    description: (p.website_description as string) || (p.description as string) || '',
    location: p.location,
    price: p.price,
    type: p.type,
    area: p.area,
    rooms: p.rooms,
    images: (JSON.parse((p.images as string) || '[]') as string[]).map(img => img.startsWith('http') ? img : CRM_BASE + img),
    created_at: p.created_at,
    floor: p.floor || null,
    condition: p.condition || null,
    parking: p.parking || null,
    terrace: p.terrace || null,
    heating: p.heating || null,
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
