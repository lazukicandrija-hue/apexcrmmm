import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

export const dynamic = 'force-dynamic';

// Public endpoint - no auth needed (for website integration)
// ONLY exposes safe, public-facing property data
const CRM_BASE = 'https://crm.apexrealestate.rs';
export async function GET() {
  const db = getDb();
  const properties = db.prepare(`
    SELECT p.id, p.title, p.description, p.location, p.price, p.type, p.area, p.rooms,
           p.images, p.created_at, p.floor, p.condition, p.parking, p.terrace, p.heating, p.featured_order
    FROM properties p
    WHERE p.published = 1 AND p.status = 'Aktivna' AND p.type != 'Novogradnja'
    ORDER BY 
      CASE WHEN p.featured_order IS NOT NULL THEN 0 ELSE 1 END ASC,
      p.featured_order ASC,
      p.created_at DESC
  `).all();

  const formatted = (properties as Record<string, unknown>[]).map(p => ({
    id: p.id,
    title: p.title,
    description: (p.description as string) || '',
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
    featured_order: p.featured_order || null,
    featured: p.featured_order !== null,
  }));

  return NextResponse.json({
    count: formatted.length,
    updated_at: new Date().toISOString(),
    properties: formatted,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    },
  });
}
