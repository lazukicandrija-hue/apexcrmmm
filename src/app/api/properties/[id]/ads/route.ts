import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// GET ad listings for a property
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const ads = db.prepare('SELECT * FROM ad_listings WHERE property_id = ? ORDER BY created_at DESC').all(id);
  return NextResponse.json({ ads });
}

// Create or update ad listing status
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    // Check if listing already exists for this platform
    const existing = db.prepare(
      'SELECT id FROM ad_listings WHERE property_id = ? AND platform = ?'
    ).get(id, body.platform) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        'UPDATE ad_listings SET status = ?, external_url = ?, last_synced_at = datetime(\'now\') WHERE id = ?'
      ).run(body.status || 'draft', body.external_url || null, existing.id);
    } else {
      db.prepare(
        'INSERT INTO ad_listings (id, property_id, platform, status, external_url, last_synced_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
      ).run(uuidv4(), id, body.platform, body.status || 'draft', body.external_url || null);
    }

    const ads = db.prepare('SELECT * FROM ad_listings WHERE property_id = ? ORDER BY created_at DESC').all(id);
    return NextResponse.json({ ads, message: 'Oglas ažuriran' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}
