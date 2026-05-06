import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser, createApiKey } from '@/lib/auth';
import { headers } from 'next/headers';

// GET - List all API keys (admin only)
export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const keys = db.prepare(`
    SELECT ak.id, ak.name, ak.key_prefix, ak.permissions, ak.active, ak.last_used_at, ak.created_at,
           u.full_name as created_by_name
    FROM api_keys ak
    LEFT JOIN users u ON ak.created_by = u.id
    ORDER BY ak.created_at DESC
  `).all();

  return NextResponse.json({ keys });
}

// POST - Create a new API key (admin only)
export async function POST(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const name = body.name || 'Novi Ključ';
    const permissions = body.permissions || ['read', 'write'];

    const result = createApiKey(name, user.id, permissions);

    return NextResponse.json({
      id: result.id,
      key: result.key, // Only shown once!
      prefix: result.prefix,
      name,
      message: 'API ključ kreiran. SAČUVAJTE KLJUČ — neće biti ponovo prikazan!',
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri kreiranju ključa' }, { status: 500 });
  }
}
