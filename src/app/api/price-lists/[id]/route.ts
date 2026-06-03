import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

// GET /api/price-lists/[id] — investor details + all units
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const investor = db.prepare('SELECT * FROM price_list_investors WHERE id = ?').get(id);
    if (!investor) return NextResponse.json({ error: 'Investitor nije pronađen' }, { status: 404 });
    const units = db.prepare('SELECT * FROM price_list_units WHERE investor_id = ? ORDER BY unit_name ASC').all(id);
    return NextResponse.json({ investor, units });
  } catch (error) {
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}

// PUT /api/price-lists/[id] — update investor
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();
    const existing = db.prepare('SELECT * FROM price_list_investors WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Investitor nije pronađen' }, { status: 404 });
    
    db.prepare(`
      UPDATE price_list_investors SET name = ?, contact_person = ?, phone = ?, email = ?, notes = ?
      WHERE id = ?
    `).run(
      body.name || (existing as any).name,
      body.contact_person ?? (existing as any).contact_person,
      body.phone ?? (existing as any).phone,
      body.email ?? (existing as any).email,
      body.notes ?? (existing as any).notes,
      id
    );
    const updated = db.prepare('SELECT * FROM price_list_investors WHERE id = ?').get(id);
    return NextResponse.json({ investor: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}

// DELETE /api/price-lists/[id] — delete investor and all units
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM price_list_investors WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Greška pri brisanju' }, { status: 500 });
  }
}
