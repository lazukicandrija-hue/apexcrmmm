import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth';
import { headers } from 'next/headers';

// Change own password (any logged-in user)
export async function PUT(request: Request) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Unesite trenutnu i novu lozinku' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Nova lozinka mora imati minimum 4 karaktera' }, { status: 400 });
    }

    const db = getDb();
    const dbUser = db.prepare('SELECT password FROM users WHERE id = ?').get(user.id) as { password: string } | undefined;
    if (!dbUser) return NextResponse.json({ error: 'Korisnik ne postoji' }, { status: 404 });

    // Verify current password
    if (!verifyPassword(currentPassword, dbUser.password)) {
      return NextResponse.json({ error: 'Trenutna lozinka nije tačna' }, { status: 403 });
    }

    // Update password
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), user.id);

    return NextResponse.json({ message: 'Lozinka uspešno promenjena ✓' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška pri promeni lozinke' }, { status: 500 });
  }
}
