import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getAuthFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';

// GET - Bot status check & API documentation
export async function GET() {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized — pošalji API ključ kao: Authorization: Bearer apex_...' }, { status: 401 });

  const db = getDb();
  const propertyCount = (db.prepare('SELECT COUNT(*) as count FROM properties').get() as { count: number }).count;
  const publishedCount = (db.prepare('SELECT COUNT(*) as count FROM properties WHERE published = 1').get() as { count: number }).count;
  const ownerCount = (db.prepare('SELECT COUNT(*) as count FROM owners').get() as { count: number }).count;
  const buyerCount = (db.prepare('SELECT COUNT(*) as count FROM buyers').get() as { count: number }).count;

  return NextResponse.json({
    status: 'ok',
    bot_name: auth.apiKey?.name || 'session_user',
    auth_type: auth.apiKey ? 'api_key' : 'session',
    permissions: auth.apiKey?.permissions || ['all'],
    stats: {
      properties: propertyCount,
      published: publishedCount,
      owners: ownerCount,
      buyers: buyerCount,
    },
    endpoints: {
      'GET /api/bot/status': 'Ovaj endpoint — status i statistike',
      'GET /api/bot/properties': 'Lista nekretnina (?type=Novogradnja&status=Aktivna&published=1)',
      'POST /api/bot/properties': 'Kreiraj nekretninu (title, location, price, type, owner_id obavezni)',
      'GET /api/bot/properties/:id': 'Detalji jedne nekretnine',
      'PUT /api/bot/properties/:id': 'Ažuriraj nekretninu (parcijalni update)',
      'GET /api/bot/owners': 'Lista vlasnika (?search=ime)',
      'POST /api/bot/owners': 'Kreiraj vlasnika (first_name, last_name obavezni)',
    },
    property_types: ['Novogradnja', 'Starogradnja', 'Lokali', 'Rente'],
    property_statuses: ['Aktivna', 'Prodato', 'U pregovoru'],
  });
}
