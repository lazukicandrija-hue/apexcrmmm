import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const property = db.prepare(`
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name,
           o.phone as owner_phone, o.email as owner_email, o.notes as owner_notes
    FROM properties p LEFT JOIN owners o ON p.owner_id = o.id WHERE p.id = ?
  `).get(id);

  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ property });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();

    // Read old values for audit log
    const old = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    db.prepare(`
      UPDATE properties SET title=?, description=?, notes=?, location=?, price=?, type=?, area=?, rooms=?,
      status=?, owner_id=?, images=?, published=?, floor=?, condition=?, parking=?, terrace=?, heating=?,
      cadastral_notes=?, contract_signed=?, reminder_text=?,
      street=?, building_number=?, apartment_number=?,
      updated_at=datetime('now') WHERE id=?
    `).run(
      body.title, body.description || '', body.notes ?? old.notes ?? '', body.location, body.price, body.type,
      body.area || null, body.rooms || null, body.status || 'Aktivna',
      body.owner_id, JSON.stringify(body.images || JSON.parse((old.images as string) || '[]')), body.published != null ? (body.published ? 1 : 0) : old.published,
      body.floor || null, body.condition || null, body.parking || null,
      body.terrace || null, body.heating || null,
      body.cadastral_notes ?? old.cadastral_notes ?? null, body.contract_signed != null ? (body.contract_signed ? 1 : 0) : old.contract_signed,
      body.reminder_text ?? old.reminder_text ?? null,
      body.street ?? old.street ?? null, body.building_number ?? old.building_number ?? null, body.apartment_number ?? old.apartment_number ?? null,
      id
    );

    // Audit log: compare fields and log changes
    const auditFields: { key: string; label: string }[] = [
      { key: 'title', label: 'Naslov' },
      { key: 'description', label: 'Opis' },
      { key: 'notes', label: 'Beleške' },
      { key: 'location', label: 'Lokacija' },
      { key: 'price', label: 'Cena' },
      { key: 'type', label: 'Tip' },
      { key: 'area', label: 'Površina' },
      { key: 'rooms', label: 'Broj soba' },
      { key: 'status', label: 'Status' },
      { key: 'owner_id', label: 'Vlasnik' },
      { key: 'floor', label: 'Sprat' },
      { key: 'condition', label: 'Stanje' },
      { key: 'parking', label: 'Parking' },
      { key: 'terrace', label: 'Terasa' },
      { key: 'heating', label: 'Grejanje' },
      { key: 'cadastral_notes', label: 'Katastar' },
      { key: 'contract_signed', label: 'Ugovor potpisan' },
      { key: 'reminder_text', label: 'Podsetnik' },
      { key: 'street', label: 'Ulica' },
      { key: 'building_number', label: 'Broj zgrade/kuće' },
      { key: 'apartment_number', label: 'Broj stana' },
    ];

    const insertAudit = db.prepare(
      'INSERT INTO property_audit_log (id, property_id, user_id, user_name, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (const f of auditFields) {
      const oldVal = String(old[f.key] ?? '');
      let newVal: string;
      if (f.key === 'contract_signed') {
        newVal = String(body.contract_signed != null ? (body.contract_signed ? 1 : 0) : old.contract_signed);
      } else {
        newVal = String(body[f.key] ?? old[f.key] ?? '');
      }
      if (oldVal !== newVal) {
        insertAudit.run(
          uuidv4(), id, (user as { id: string }).id, (user as { full_name: string }).full_name,
          f.label, oldVal || '(prazno)', newVal || '(prazno)'
        );
      }
    }

    return NextResponse.json({ message: 'Nekretnina ažurirana' });
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
  db.prepare('DELETE FROM properties WHERE id = ?').run(id);
  return NextResponse.json({ message: 'Nekretnina obrisana' });
}
