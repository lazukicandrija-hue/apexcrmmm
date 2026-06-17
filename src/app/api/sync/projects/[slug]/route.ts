import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

export const dynamic = 'force-dynamic';

// Public endpoint - get single project by slug (for website)
// NO auth required, NO private data exposed
const CRM_BASE = 'https://crm.apexrealestate.rs';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();

  // Get all projects and find by slug match
  const projects = db.prepare(`
    SELECT p.id, p.name, p.location, p.description, p.total_units, p.images, p.website_description, p.completion_date
    FROM projects p
    ORDER BY p.created_at DESC
  `).all() as Record<string, unknown>[];

  const project = projects.find(p => {
    const projectSlug = (p.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    return projectSlug === slug;
  });

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Get published units for this project
  const units = db.prepare(`
    SELECT p.id, p.title, p.location, p.price, p.area, p.rooms, p.floor,
           p.images, p.status, p.type, p.website_description, p.condition,
           p.parking, p.terrace, p.heating, p.featured_order
    FROM properties p
    WHERE p.project_id = ? AND p.published = 1 AND p.status IN ('Aktivna', 'Prodato')
    ORDER BY p.code ASC
  `).all(project.id as string) as Record<string, unknown>[];

  const formattedUnits = units.map(u => ({
    id: u.id,
    title: u.title,
    description: (u.website_description as string) || '',
    location: u.location,
    price: u.price,
    area: u.area,
    rooms: u.rooms,
    floor: u.floor || null,
    images: (JSON.parse((u.images as string) || '[]') as string[]).map(img => img.startsWith('http') ? img : CRM_BASE + img),
    status: u.status,
    type: u.type,
    condition: u.condition || null,
    parking: u.parking || null,
    terrace: u.terrace || null,
    heating: u.heating || null,
    featured_order: u.featured_order || null,
  }));

  // Parse project images
  const projectImages = (JSON.parse((project.images as string) || '[]') as string[]).map(
    img => img.startsWith('http') ? img : CRM_BASE + img
  );

  const formatted = {
    id: project.id,
    name: project.name,
    slug: (project.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    location: project.location,
    description: (project.description as string) || '',
    website_description: (project.website_description as string) || '',
    completion_date: (project.completion_date as string) || null,
    // NOTE: developer/investor info is intentionally NOT exposed
    total_units: project.total_units,
    images: projectImages,
    units: formattedUnits,
    available_count: formattedUnits.filter(u => u.status === 'Aktivna').length,
  };

  return NextResponse.json({ project: formatted }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    },
  });
}
