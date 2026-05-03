import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const properties = db.prepare(`
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name, o.phone as owner_phone
    FROM properties p LEFT JOIN owners o ON p.owner_id = o.id ORDER BY p.created_at DESC
  `).all() as Record<string, unknown>[];

  const csvHeader = 'ID,Naslov,Lokacija,Cena,Tip,Površina,Sobe,Status,Vlasnik,Telefon Vlasnika,Objavljeno,Datum\n';
  const csvRows = properties.map((p) =>
    `"${p.id}","${p.title}","${p.location}",${p.price},"${p.type}",${p.area},${p.rooms},"${p.status}","${p.owner_first_name} ${p.owner_last_name}","${p.owner_phone}",${p.published ? 'Da' : 'Ne'},"${p.created_at}"`
  ).join('\n');

  return new NextResponse(csvHeader + csvRows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=nekretnine.csv',
    },
  });
}
