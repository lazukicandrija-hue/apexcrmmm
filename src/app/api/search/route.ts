import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Global search across properties, buyers, and owners
export async function GET(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const db = getDb();
  const term = `%${q.trim()}%`;

  // Search properties
  const properties = db.prepare(`
    SELECT id, title, location, price, type, status FROM properties 
    WHERE title LIKE ? OR location LIKE ? OR description LIKE ?
    LIMIT 5
  `).all(term, term, term) as { id: string; title: string; location: string; price: number; type: string; status: string }[];

  // Search buyers
  const buyers = db.prepare(`
    SELECT id, first_name, last_name, phone, desired_type, status FROM buyers
    WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR (first_name || ' ' || last_name) LIKE ?
    LIMIT 5
  `).all(term, term, term, term) as { id: string; first_name: string; last_name: string; phone: string; desired_type: string; status: string }[];

  // Search owners
  const owners = db.prepare(`
    SELECT id, first_name, last_name, phone, email FROM owners
    WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR (first_name || ' ' || last_name) LIKE ?
    LIMIT 5
  `).all(term, term, term, term, term) as { id: string; first_name: string; last_name: string; phone: string; email: string }[];

  return NextResponse.json({
    results: [
      ...properties.map(p => ({
        type: 'property' as const,
        id: p.id,
        title: p.title,
        subtitle: `${p.location} · ${p.type}`,
        badge: p.status,
        href: `/dashboard/properties/${p.id}`,
        icon: '🏠',
      })),
      ...buyers.map(b => ({
        type: 'buyer' as const,
        id: b.id,
        title: `${b.first_name} ${b.last_name}`,
        subtitle: `${b.phone || ''} · ${b.desired_type || ''}`,
        badge: b.status,
        href: `/dashboard/buyers/${b.id}`,
        icon: '👤',
      })),
      ...owners.map(o => ({
        type: 'owner' as const,
        id: o.id,
        title: `${o.first_name} ${o.last_name}`,
        subtitle: `${o.phone || ''} · ${o.email || ''}`,
        badge: 'Vlasnik',
        href: `/dashboard/properties?search=${encodeURIComponent(o.first_name + ' ' + o.last_name)}`,
        icon: '🔑',
      })),
    ],
    query: q,
  });
}
