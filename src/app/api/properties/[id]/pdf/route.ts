import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

// Generate a professional property sheet as downloadable HTML (print-optimized)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const property = db.prepare(`
    SELECT p.*, o.first_name as owner_first_name, o.last_name as owner_last_name,
           o.phone as owner_phone, o.email as owner_email
    FROM properties p LEFT JOIN owners o ON p.owner_id = o.id WHERE p.id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const images: string[] = JSON.parse((property.images as string) || '[]');
  const formatPrice = (p: number) => p >= 1000 ? `€${p.toLocaleString('sr-RS')}` : `€${p}/mesec`;
  const pricePerM2 = property.area ? `€${Math.round((property.price as number) / (property.area as number)).toLocaleString('sr-RS')}/m²` : '-';

  const detailRow = (label: string, value: string | number | null | undefined) => {
    if (!value) return '';
    return `<tr><td style="padding:10px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;width:160px">${label}</td><td style="padding:10px 16px;font-weight:500;border-bottom:1px solid #eee">${value}</td></tr>`;
  };

  const html = `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8">
<title>${property.title} — APEX Real Estate</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#fff; color:#1a1a1a; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display:none !important; }
    @page { margin: 15mm; size: A4; }
  }
  .sheet { max-width:800px; margin:0 auto; padding:40px; }
  .header { display:flex; justify-content:space-between; align-items:center; padding-bottom:24px; border-bottom:3px solid #D4AF37; margin-bottom:30px; }
  .brand { font-size:28px; font-weight:700; letter-spacing:2px; color:#D4AF37; }
  .brand-sub { font-size:11px; color:#888; letter-spacing:4px; text-transform:uppercase; }
  .date-info { text-align:right; font-size:12px; color:#999; }
  .title-block { margin-bottom:28px; }
  .prop-title { font-size:24px; font-weight:700; margin-bottom:4px; }
  .prop-location { font-size:14px; color:#666; }
  .price-banner { background:linear-gradient(135deg,#1a1a1a,#2a2a2a); color:#D4AF37; padding:20px 28px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; }
  .price-main { font-size:28px; font-weight:700; }
  .price-m2 { font-size:14px; color:#aaa; }
  .section-title { font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:2px; color:#D4AF37; margin:28px 0 12px; }
  .details-table { width:100%; border-collapse:collapse; }
  .images-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
  .images-grid img { width:100%; height:140px; object-fit:cover; border-radius:6px; }
  .description { font-size:14px; line-height:1.7; color:#444; margin-top:12px; }
  .footer { margin-top:40px; padding-top:20px; border-top:2px solid #D4AF37; display:flex; justify-content:space-between; font-size:12px; color:#999; }
  .print-btn { position:fixed; bottom:24px; right:24px; background:#D4AF37; color:#000; border:none; padding:14px 28px; border-radius:8px; font-weight:600; cursor:pointer; font-size:14px; box-shadow:0 4px 20px rgba(212,175,55,0.4); z-index:100; }
  .print-btn:hover { transform:scale(1.05); }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Štampaj / Sačuvaj PDF</button>
<div class="sheet">
  <div class="header">
    <div>
      <div class="brand">APEX</div>
      <div class="brand-sub">Real Estate</div>
    </div>
    <div class="date-info">
      Property Sheet<br>
      ${new Date().toLocaleDateString('sr-RS', { day:'2-digit', month:'long', year:'numeric' })}
    </div>
  </div>

  <div class="title-block">
    <div class="prop-title">${property.title}</div>
    <div class="prop-location">📍 ${property.location}</div>
  </div>

  <div class="price-banner">
    <div>
      <div class="price-main">${formatPrice(property.price as number)}</div>
      <div class="price-m2">${pricePerM2}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;color:#aaa">Status</div>
      <div style="font-size:16px;font-weight:600;color:#fff">${property.status}</div>
    </div>
  </div>

  <div class="section-title">Karakteristike</div>
  <table class="details-table">
    ${detailRow('Tip', property.type as string)}
    ${detailRow('Površina', `${property.area} m²`)}
    ${detailRow('Sobe', property.rooms as number)}
    ${detailRow('Sprat', property.floor as string)}
    ${detailRow('Stanje', property.condition as string)}
    ${detailRow('Parking', property.parking as string)}
    ${detailRow('Terasa', property.terrace as string)}
    ${detailRow('Grejanje', property.heating as string)}
  </table>

  ${(property.description as string) ? `
  <div class="section-title">Opis</div>
  <div class="description">${(property.description as string).replace(/\n/g, '<br>')}</div>
  ` : ''}

  ${images.length > 0 ? `
  <div class="section-title">Galerija</div>
  <div class="images-grid">
    ${images.slice(0, 6).map(img => `<img src="${img.startsWith('http') ? img : 'https://crm.apexrealestate.rs' + img}" alt="" />`).join('')}
  </div>
  ` : ''}

  <div class="footer">
    <div>
      <strong style="color:#D4AF37">APEX Real Estate</strong><br>
      www.apexrealestate.rs
    </div>
    <div style="text-align:right">
      Dokument generisan: ${new Date().toLocaleDateString('sr-RS')}<br>
      Ref: ${(property.id as string).slice(0, 8).toUpperCase()}
    </div>
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
