import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getAuthFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// GET - List buyers (supports API key auth)
export async function GET(request: Request) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized — pošalji API ključ kao Bearer token' }, { status: 401 });

  if (auth.apiKey && !auth.apiKey.permissions.includes('read')) {
    return NextResponse.json({ error: 'Nedovoljna ovlašćenja' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');

  const db = getDb();
  let query = 'SELECT * FROM buyers WHERE 1=1';
  const params: string[] = [];

  if (status) { query += ` AND status = ?`; params.push(status); }
  if (type) { query += ` AND desired_type = ?`; params.push(type); }

  query += ' ORDER BY created_at DESC';

  const buyers = db.prepare(query).all(...params);
  return NextResponse.json({
    count: (buyers as unknown[]).length,
    buyers,
    auth_type: auth.apiKey ? 'api_key' : 'session',
    bot_name: auth.apiKey?.name || null,
  });
}

// POST - Create a new buyer (supports API key auth)
export async function POST(request: Request) {
  const headersList = await headers();
  const auth = getAuthFromRequest(headersList);
  if (!auth) return NextResponse.json({ error: 'Unauthorized — pošalji API ključ kao Bearer token' }, { status: 401 });

  if (auth.apiKey && !auth.apiKey.permissions.includes('write')) {
    return NextResponse.json({ error: 'Nedovoljna ovlašćenja za pisanje' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // ── Validation ──
    const errors: string[] = [];

    if (!body.first_name || typeof body.first_name !== 'string' || body.first_name.trim().length === 0) {
      errors.push('first_name: obavezno polje (ime kupca)');
    }
    if (!body.last_name || typeof body.last_name !== 'string' || body.last_name.trim().length === 0) {
      errors.push('last_name: obavezno polje (prezime kupca)');
    }

    if (body.budget !== undefined && body.budget !== null && body.budget !== '') {
      const budgetNum = Number(body.budget);
      if (isNaN(budgetNum) || budgetNum < 0) {
        errors.push(`budget: "${body.budget}" nije validan broj — pošalji budžet kao broj, npr. 90000`);
      }
    }

    if (body.status && !['Aktivan', 'Pauzirana Potraga', 'Kupio Stan'].includes(body.status)) {
      errors.push(`status: "${body.status}" nije validan — mora biti: Aktivan, Pauzirana Potraga, Kupio Stan`);
    }

    if (body.desired_type && !['Novogradnja', 'Sekundarni Stanovi', 'Rente', 'Lokali'].includes(body.desired_type)) {
      errors.push(`desired_type: "${body.desired_type}" nije validan — mora biti: Novogradnja, Sekundarni Stanovi, Rente, Lokali`);
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Validacija nije prošla',
        validation_errors: errors,
        field_reference: {
          required: {
            first_name: 'string — ime kupca',
            last_name: 'string — prezime kupca',
          },
          optional: {
            phone: 'string — telefon kupca',
            email: 'string — email kupca',
            desired_type: 'enum — Novogradnja | Sekundarni Stanovi | Rente | Lokali',
            desired_rooms: 'string — željena sobnost, npr. "Jednosoban", "Dvosoban", "Trosoban"',
            financing: 'string — Keš | Kredit | Kombinovano',
            budget: 'number — budžet u EUR',
            location: 'string — tekstualni opis lokacije',
            preferred_locations: 'string[] — niz željenih lokacija, npr. ["Centar", "Grbavica"]',
            notes: 'string — napomene, posebni zahtevi',
            next_action_date: 'string — datum sledeće akcije (YYYY-MM-DD)',
            status: 'enum — Aktivan | Pauzirana Potraga | Kupio Stan (default: Aktivan)',
          },
        },
      }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    const budget = body.budget != null && body.budget !== '' ? Number(body.budget) : null;

    db.prepare(`
      INSERT INTO buyers (id, first_name, last_name, phone, email, desired_type, location, budget, notes, next_action_date, status, financing, desired_rooms, preferred_locations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.first_name.trim(),
      body.last_name.trim(),
      body.phone || '',
      body.email || '',
      body.desired_type || '',
      body.location || '',
      budget,
      body.notes || '',
      body.next_action_date || null,
      body.status || 'Aktivan',
      body.financing || '',
      body.desired_rooms || '',
      body.preferred_locations ? JSON.stringify(body.preferred_locations) : ''
    );

    // Add initial interaction note if notes provided
    if (body.notes) {
      db.prepare(`INSERT INTO buyer_interactions (id, buyer_id, note) VALUES (?, ?, ?)`).run(
        uuidv4(), id, `Inicijalni kontakt: ${body.notes}`
      );
    }

    return NextResponse.json({
      id,
      message: 'Kupac kreiran od strane bota',
      created: {
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        desired_type: body.desired_type || null,
        desired_rooms: body.desired_rooms || null,
        budget,
        status: body.status || 'Aktivan',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Bot buyer creation error:', error);
    return NextResponse.json({
      error: 'Greška pri kreiranju kupca',
      tip: 'Proveri da li šalješ validan JSON sa Content-Type: application/json',
    }, { status: 500 });
  }
}
