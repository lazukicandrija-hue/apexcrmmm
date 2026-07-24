import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Returns list of agents (id + full_name only) for filter dropdowns
// Requires login but NOT admin role
export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const agents = db.prepare('SELECT id, full_name, role FROM users ORDER BY full_name ASC').all();
  return NextResponse.json({ agents });
}
