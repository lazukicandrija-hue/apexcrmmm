import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

// Serve uploaded files from DATA_DIR/uploads/
// This handles URLs like /api/uploads/properties/{id}/{filename}
// and /api/uploads/projects/{id}/{filename}
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Security: prevent directory traversal
  const safePath = segments.join('/').replace(/\.\./g, '');
  
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'uploads', safePath);

  // Ensure the resolved path is still within the uploads directory
  const uploadsDir = path.join(dataDir, 'uploads');
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Check file exists
    await stat(filePath);

    const fileBuffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
