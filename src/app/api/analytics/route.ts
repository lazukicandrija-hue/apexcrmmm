import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Dashboard analytics data
export async function GET() {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Properties by type
  const byType = db.prepare(`
    SELECT type, COUNT(*) as count FROM properties GROUP BY type ORDER BY count DESC
  `).all() as { type: string; count: number }[];

  // Properties by status
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM properties GROUP BY status ORDER BY count DESC
  `).all() as { status: string; count: number }[];

  // Monthly additions (last 6 months)
  const monthlyProps = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
    FROM properties
    WHERE created_at >= date('now', '-6 months')
    GROUP BY month ORDER BY month ASC
  `).all() as { month: string; count: number }[];

  const monthlyBuyers = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
    FROM buyers
    WHERE created_at >= date('now', '-6 months')
    GROUP BY month ORDER BY month ASC
  `).all() as { month: string; count: number }[];

  // Price range distribution
  const priceRanges = db.prepare(`
    SELECT
      CASE
        WHEN price < 50000 THEN '< €50K'
        WHEN price < 100000 THEN '€50-100K'
        WHEN price < 200000 THEN '€100-200K'
        WHEN price < 500000 THEN '€200-500K'
        ELSE '€500K+'
      END as range,
      COUNT(*) as count
    FROM properties WHERE price >= 1000
    GROUP BY range ORDER BY MIN(price) ASC
  `).all() as { range: string; count: number }[];

  // Buyers pipeline
  const buyerPipeline = db.prepare(`
    SELECT status, COUNT(*) as count FROM buyers GROUP BY status ORDER BY count DESC
  `).all() as { status: string; count: number }[];

  // Top locations
  const topLocations = db.prepare(`
    SELECT location, COUNT(*) as count FROM properties GROUP BY location ORDER BY count DESC LIMIT 5
  `).all() as { location: string; count: number }[];

  // Total portfolio value
  const totalValue = db.prepare(`
    SELECT SUM(price) as total FROM properties WHERE price >= 1000 AND status = 'Aktivna'
  `).get() as { total: number };

  // Stale properties (active 30+ days)
  const staleProperties = db.prepare(`
    SELECT p.id, p.title, p.location, p.price, p.type, p.created_at,
           julianday('now') - julianday(p.created_at) as days_active
    FROM properties p
    WHERE p.status = 'Aktivna' AND julianday('now') - julianday(p.created_at) >= 30
    ORDER BY days_active DESC
  `).all() as { id: string; title: string; location: string; price: number; type: string; created_at: string; days_active: number }[];

  return NextResponse.json({
    byType,
    byStatus,
    monthlyProps,
    monthlyBuyers,
    priceRanges,
    buyerPipeline,
    topLocations,
    totalValue: totalValue?.total || 0,
    staleProperties,
  });
}
