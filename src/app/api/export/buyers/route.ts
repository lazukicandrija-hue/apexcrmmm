import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const buyers = db.prepare('SELECT * FROM buyers ORDER BY created_at DESC').all() as Record<string, unknown>[];

  const csvHeader = 'ID,Ime,Prezime,Telefon,Email,Traženi Tip,Lokacija,Budžet,Status,Sledeća Akcija,Napomene\n';
  const csvRows = buyers.map((b) =>
    `"${b.id}","${b.first_name}","${b.last_name}","${b.phone}","${b.email}","${b.desired_type}","${b.location}",${b.budget},"${b.status}","${b.next_action_date || ''}","${(b.notes as string || '').replace(/"/g, '""')}"`
  ).join('\n');

  return new NextResponse(csvHeader + csvRows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=kupci.csv',
    },
  });
}
