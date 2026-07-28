import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Serve uploaded files: rewrite /uploads/* → /api/uploads/*
  if (pathname.startsWith('/uploads/')) {
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/api${pathname}`;
    return NextResponse.rewrite(newUrl);
  }

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('apex_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Basic JWT structure check (full verification happens server-side)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect root to dashboard or login
  if (pathname === '/') {
    const token = request.cookies.get('apex_token')?.value;
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/uploads/:path*'],
};
