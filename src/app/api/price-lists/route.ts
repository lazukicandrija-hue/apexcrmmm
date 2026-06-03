import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { v4 as uuidv4 } from 'uuid';

// GET /api/price-lists — list all investors with unit counts
export async function GET() {
  try {
    const db = getDb();
    const investors = db.prepare(`
      SELECT pli.*, 
        (SELECT COUNT(*) FROM price_list_units WHERE investor_id = pli.id) as unit_count,
        (SELECT COUNT(*) FROM price_list_units WHERE investor_id = pli.id AND availability = 'Dostupan') as available_count,
        (SELECT COUNT(*) FROM price_list_units WHERE investor_id = pli.id AND availability = 'Prodat') as sold_count
      FROM price_list_investors pli
      ORDER BY pli.name ASC
    `).all();
    return NextResponse.json({ investors });
  } catch (error) {
    return NextResponse.json({ error: 'Greška pri učitavanju investitora' }, { status: 500 });
  }
}

// POST /api/price-lists — create new investor
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Naziv investitora je obavezan' }, { status: 400 });
    }
    const id = uuidv4();
    db.prepare(`
      INSERT INTO price_list_investors (id, name, contact_person, phone, email, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, body.name.trim(), body.contact_person || '', body.phone || '', body.email || '', body.notes || '');
    const investor = db.prepare('SELECT * FROM price_list_investors WHERE id = ?').get(id);
    return NextResponse.json({ investor }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Greška pri kreiranju investitora' }, { status: 500 });
  }
}
