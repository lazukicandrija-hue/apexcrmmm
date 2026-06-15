import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/db/database';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Upload images for a project (building renders)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const project = db.prepare('SELECT id, images FROM projects WHERE id = ?').get(id) as { id: string; images: string } | undefined;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const uploadDir = path.join(dataDir, 'uploads', 'projects', id);
    await mkdir(uploadDir, { recursive: true });

    const existingImages: string[] = JSON.parse(project.images || '[]');
    const newImagePaths: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = path.join(uploadDir, filename);
      
      await writeFile(filePath, buffer);
      newImagePaths.push(`/uploads/projects/${id}/${filename}`);
    }

    const allImages = [...existingImages, ...newImagePaths];
    db.prepare('UPDATE projects SET images = ? WHERE id = ?').run(JSON.stringify(allImages), id);

    return NextResponse.json({ 
      message: `${newImagePaths.length} slika uploadovano`,
      images: allImages 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Greška pri uploadu' }, { status: 500 });
  }
}

// Delete a specific image from project
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const user = getCurrentUser(headersList.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  
  try {
    const body = await request.json();
    const imagePath = body.imagePath;
    
    const project = db.prepare('SELECT images FROM projects WHERE id = ?').get(id) as { images: string } | undefined;
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const images: string[] = JSON.parse(project.images || '[]');
    const filtered = images.filter(img => img !== imagePath);
    
    db.prepare('UPDATE projects SET images = ? WHERE id = ?').run(JSON.stringify(filtered), id);

    try {
      const { unlink } = await import('fs/promises');
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      const fullPath = path.join(dataDir, imagePath);
      await unlink(fullPath);
    } catch { /* file might not exist */ }

    return NextResponse.json({ message: 'Slika obrisana', images: filtered });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}
