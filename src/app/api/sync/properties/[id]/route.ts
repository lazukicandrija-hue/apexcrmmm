import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

// Public endpoint - get single published property by ID (for website)
// NO auth required, NO private data exposed
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  
  const property = db.prepare(`
    SELECT p.id, p.title, p.description, p.location, p.price, p.type, p.area, p.rooms,
           p.images, p.created_at
    FROM properties p
    WHERE p.id = ? AND p.published = 1 AND p.status = 'Aktivna'
  `).get(id) as Record<string, unknown> | undefined;

  if (!property) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const formatted = {
    id: property.id,
    title: property.title,
    description: property.description,
    location: property.location,
    price: property.price,
    type: property.type,
    area: property.area,
    rooms: property.rooms,
    images: JSON.parse((property.images as string) || '[]'),
    created_at: property.created_at,
  };

  return NextResponse.json({ property: formatted }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
