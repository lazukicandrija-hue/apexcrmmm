import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// GET /api/trash — everything that was deleted (admin only)
export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Samo admin' }, { status: 403 });

  const db = getDb();
  const records = db.prepare(`
    SELECT id, entity, entity_id, label, deleted_by_name, deleted_at, restored_at, restored_by_name
    FROM deleted_records ORDER BY deleted_at DESC LIMIT 500
  `).all();
  return NextResponse.json({ records });
}
