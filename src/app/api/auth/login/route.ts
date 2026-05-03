import { NextResponse } from 'next/server';
import { login } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Korisničko ime i lozinka su obavezni' }, { status: 400 });
    }

    const token = login(username, password);
    if (!token) {
      return NextResponse.json({ error: 'Pogrešno korisničko ime ili lozinka' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('apex_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Greška na serveru' }, { status: 500 });
  }
}
