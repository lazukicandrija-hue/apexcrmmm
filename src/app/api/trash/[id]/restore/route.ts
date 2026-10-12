import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { restoreFromTrash } from '@/lib/trash';

// POST /api/trash/[id]/restore — put a deleted record back (admin only)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Samo admin' }, { status: 403 });

  const { id } = await params;
  try {
    restoreFromTrash(getDb(), id, user);
    return NextResponse.json({ message: 'Vraćeno' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Greška pri vraćanju' }, { status: 400 });
  }
}
