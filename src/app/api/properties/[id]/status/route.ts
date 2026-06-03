import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';
import { v4 as uuidv4 } from 'uuid';

const STATUS_CYCLE = ['Aktivna', 'U pregovoru', 'Prodato'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const property = db.prepare('SELECT status, title FROM properties WHERE id = ?').get(id) as { status: string; title: string } | undefined;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const currentIdx = STATUS_CYCLE.indexOf(property.status);
  const newStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];

  db.prepare('UPDATE properties SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newStatus, id);

  // Audit log
  db.prepare(
    'INSERT INTO property_audit_log (id, property_id, user_id, user_name, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    uuidv4(), id, (user as { id: string }).id, (user as { full_name: string }).full_name,
    'Status', property.status, newStatus
  );

  return NextResponse.json({ status: newStatus, message: `Status: ${newStatus}` });
}
