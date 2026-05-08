import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const property = db.prepare('SELECT published, contract_signed, title FROM properties WHERE id = ?').get(id) as { published: number; contract_signed: number; title: string } | undefined;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If trying to publish and contract not signed, block it
  if (!property.published && !property.contract_signed) {
    return NextResponse.json({ 
      error: 'Ugovor nije potpisan — nekretnina ne može biti objavljena na sajtu bez potpisanog ugovora o posredovanju.',
      code: 'CONTRACT_REQUIRED'
    }, { status: 400 });
  }

  const newStatus = property.published ? 0 : 1;
  db.prepare('UPDATE properties SET published = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newStatus, id);

  // Audit log
  db.prepare(
    'INSERT INTO property_audit_log (id, property_id, user_id, user_name, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    uuidv4(), id, (user as { id: string }).id, (user as { full_name: string }).full_name,
    'Objava na sajtu', property.published ? 'Objavljeno' : 'Nije objavljeno', newStatus ? 'Objavljeno' : 'Nije objavljeno'
  );

  return NextResponse.json({ published: !!newStatus, message: newStatus ? 'Objavljeno na sajtu ✓' : 'Uklonjeno sa sajta' });
}
