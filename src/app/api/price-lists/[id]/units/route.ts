import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { v4 as uuidv4 } from 'uuid';

// GET /api/price-lists/[id]/units — list units for investor
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const units = db.prepare('SELECT * FROM price_list_units WHERE investor_id = ? ORDER BY unit_name ASC').all(id);
    return NextResponse.json({ units });
  } catch (error) {
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}

// POST /api/price-lists/[id]/units — add unit to investor
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();
    
    if (!body.unit_name?.trim()) {
      return NextResponse.json({ error: 'Naziv stana je obavezan' }, { status: 400 });
    }
    
    const unitId = uuidv4();
    const area = parseFloat(body.area) || 0;
    const pricePerM2 = parseFloat(body.price_per_m2) || 0;
    const totalPrice = parseFloat(body.total_price) || (area * pricePerM2);
    
    db.prepare(`
      INSERT INTO price_list_units (id, investor_id, unit_name, floor, area, price_per_m2, total_price, availability, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(unitId, id, body.unit_name.trim(), body.floor || '', area, pricePerM2, totalPrice, body.availability || 'Dostupan', body.notes || '');
    
    const unit = db.prepare('SELECT * FROM price_list_units WHERE id = ?').get(unitId);
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Greška pri dodavanju stana' }, { status: 500 });
  }
}
