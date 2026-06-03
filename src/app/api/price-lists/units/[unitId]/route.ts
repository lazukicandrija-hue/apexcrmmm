import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

// PUT /api/price-lists/units/[unitId] — update unit
export async function PUT(request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  try {
    const { unitId } = await params;
    const db = getDb();
    const body = await request.json();
    const existing = db.prepare('SELECT * FROM price_list_units WHERE id = ?').get(unitId) as any;
    if (!existing) return NextResponse.json({ error: 'Stan nije pronađen' }, { status: 404 });

    const area = body.area !== undefined ? parseFloat(body.area) || 0 : existing.area;
    const pricePerM2 = body.price_per_m2 !== undefined ? parseFloat(body.price_per_m2) || 0 : existing.price_per_m2;
    const totalPrice = body.total_price !== undefined ? parseFloat(body.total_price) || 0 : (body.area !== undefined || body.price_per_m2 !== undefined ? area * pricePerM2 : existing.total_price);

    db.prepare(`
      UPDATE price_list_units SET unit_name = ?, floor = ?, area = ?, price_per_m2 = ?, total_price = ?, availability = ?, notes = ?
      WHERE id = ?
    `).run(
      body.unit_name ?? existing.unit_name,
      body.floor ?? existing.floor,
      area,
      pricePerM2,
      totalPrice,
      body.availability ?? existing.availability,
      body.notes ?? existing.notes,
      unitId
    );
    const updated = db.prepare('SELECT * FROM price_list_units WHERE id = ?').get(unitId);
    return NextResponse.json({ unit: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}

// DELETE /api/price-lists/units/[unitId] — delete unit
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  try {
    const { unitId } = await params;
    const db = getDb();
    db.prepare('DELETE FROM price_list_units WHERE id = ?').run(unitId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Greška pri brisanju' }, { status: 500 });
  }
}
