import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const buyer = db.prepare('SELECT * FROM buyers WHERE id = ?').get(id);
  if (!buyer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const interactions = db.prepare(
    'SELECT * FROM buyer_interactions WHERE buyer_id = ? ORDER BY created_at DESC'
  ).all(id);

  return NextResponse.json({ buyer, interactions });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    // Partial update — just status, next_action_date, priority, or agent_id
    const partialKeys = ['status', 'next_action_date', 'priority', 'agent_id'];
    const bodyKeys = Object.keys(body);
    if (bodyKeys.length <= 2 && bodyKeys.every(k => partialKeys.includes(k))) {
      if (body.status !== undefined) {
        db.prepare('UPDATE buyers SET status = ? WHERE id = ?').run(body.status, id);
      }
      if (body.next_action_date !== undefined) {
        db.prepare('UPDATE buyers SET next_action_date = ? WHERE id = ?').run(body.next_action_date || null, id);
      }
      if (body.priority !== undefined) {
        db.prepare('UPDATE buyers SET priority = ? WHERE id = ?').run(body.priority, id);
      }
      if (body.agent_id !== undefined) {
        db.prepare('UPDATE buyers SET agent_id = ? WHERE id = ?').run(body.agent_id || null, id);
      }
      return NextResponse.json({ message: 'Kupac ažuriran' });
    }

    // Full update — preserve agent_id if not explicitly sent
    const existing = db.prepare('SELECT agent_id FROM buyers WHERE id = ?').get(id) as { agent_id: string | null } | undefined;
    const agentId = body.agent_id !== undefined ? (body.agent_id || null) : (existing?.agent_id ?? null);

    db.prepare(`
      UPDATE buyers SET first_name=?, last_name=?, phone=?, email=?, desired_type=?,
      location=?, budget=?, notes=?, next_action_date=?, status=?,
      financing=?, desired_rooms=?, preferred_locations=?, priority=?, agent_id=? WHERE id=?
    `).run(
      body.first_name, body.last_name, body.phone || '', body.email || '',
      body.desired_type || '', body.location || '', body.budget || null,
      body.notes || '', body.next_action_date || null, body.status || 'Aktivan',
      body.financing || '', body.desired_rooms || '',
      body.preferred_locations ? (typeof body.preferred_locations === 'string' ? body.preferred_locations : JSON.stringify(body.preferred_locations)) : '',
      body.priority || 'low',
      agentId,
      id
    );
    return NextResponse.json({ message: 'Kupac ažuriran' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM buyers WHERE id = ?').run(id);
  return NextResponse.json({ message: 'Kupac obrisan' });
}
