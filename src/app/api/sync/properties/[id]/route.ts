import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

export const dynamic = 'force-dynamic';

// Public endpoint - get single published property by ID (for website)
// NO auth required, NO private data exposed
const CRM_BASE = 'https://crm.apexrealestate.rs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  
  const property = db.prepare(`
    SELECT p.id, p.title, p.website_description, p.location, p.price, p.type, p.area, p.rooms,
           p.images, p.created_at, p.floor, p.condition, p.parking, p.terrace, p.heating, p.featured_order
    FROM properties p
    WHERE p.id = ? AND p.published = 1 AND p.status = 'Aktivna'
  `).get(id) as Record<string, unknown> | undefined;

  if (!property) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const formatted = {
    id: property.id,
    title: property.title,
    description: (property.website_description as string) || '',
    location: property.location,
    price: property.price,
    type: property.type,
    area: property.area,
    rooms: property.rooms,
    images: (JSON.parse((property.images as string) || '[]') as string[]).map(img => img.startsWith('http') ? img : CRM_BASE + img),
    created_at: property.created_at,
    floor: property.floor || null,
    condition: property.condition || null,
    parking: property.parking || null,
    terrace: property.terrace || null,
    heating: property.heating || null,
    featured_order: property.featured_order || null,
    featured: property.featured_order !== null,
  };

  return NextResponse.json({ property: formatted }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    },
  });
}
