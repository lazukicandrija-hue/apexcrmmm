import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
  const headersList = await headers();
  const cookie = headersList.get('cookie');
  const user = getCurrentUser(cookie);

  if (!user) {
    return NextResponse.json({ error: 'Niste prijavljeni' }, { status: 401 });
  }

  return NextResponse.json({ user });
}
