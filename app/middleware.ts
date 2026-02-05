// app/middleware.ts
import { getCurrentAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for API routes, static files, and login page
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/login'
  ) {
    return NextResponse.next();
  }

  try {
    const admin = await getCurrentAdmin();
    
    if (!admin) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check if admin has access to the requested route
    const hasAccess = admin.permissions?.[pathname as keyof typeof admin.permissions];
    
    if (!hasAccess) {
      // Redirect to dashboard or show access denied
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};