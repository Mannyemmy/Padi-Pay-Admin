import { getCurrentAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { activityLogger } from '@/lib/services/activityLogger';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Skip files with extensions
  ) {
    return NextResponse.next();
  }

  // Skip login page - we'll track login separately
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Skip inspect page - temporary data viewer
  if (pathname === '/inspect') {
    return NextResponse.next();
  }

  try {
    const admin = await getCurrentAdmin();
    
    if (!admin) {
      // No admin, redirect to login preserving the intended destination
      if (pathname !== '/login') {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    // Check if admin has access to the requested route
    // Strip /admin/v2 prefix for permission checking (demo mode uses same permissions)
    const DEMO_PREFIX = '/admin/v2';
    const basePath = pathname.startsWith(DEMO_PREFIX) ? (pathname.slice(DEMO_PREFIX.length) || '/') : pathname;
    const hasAccess = admin.permissions?.[basePath as keyof typeof admin.permissions];
    
    if (!hasAccess) {
      // Log unauthorized access attempt
      const userAgent = request.headers.get('user-agent') || '';
      
      // Get IP address from headers
      let ipAddress = 'unknown';
      const forwardedFor = request.headers.get('x-forwarded-for');
      if (forwardedFor) {
        ipAddress = forwardedFor.split(',')[0].trim();
      } else {
        const realIp = request.headers.get('x-real-ip');
        if (realIp) {
          ipAddress = realIp;
        } else {
          // Try to get IP from the request connection
          const cfConnectingIp = request.headers.get('cf-connecting-ip');
          if (cfConnectingIp) {
            ipAddress = cfConnectingIp;
          }
        }
      }
      
      await activityLogger.logApiCall(
        admin.id!,
        admin.email,
        admin.name,
        pathname,
        request.method,
        403,
        { attemptedAccess: pathname },
        userAgent,
        ipAddress
      );
      
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Log page view for authorized routes (except API routes)
    if (!pathname.startsWith('/api/')) {
      const userAgent = request.headers.get('user-agent') || '';
      
      // Get IP address from headers
      let ipAddress = 'unknown';
      const forwardedFor = request.headers.get('x-forwarded-for');
      if (forwardedFor) {
        ipAddress = forwardedFor.split(',')[0].trim();
      } else {
        const realIp = request.headers.get('x-real-ip');
        if (realIp) {
          ipAddress = realIp;
        } else {
          // Try to get IP from the request connection
          const cfConnectingIp = request.headers.get('cf-connecting-ip');
          if (cfConnectingIp) {
            ipAddress = cfConnectingIp;
          }
        }
      }
      
      await activityLogger.logApiCall(
        admin.id!,
        admin.email,
        admin.name,
        pathname,
        'GET',
        200,
        { 
          pageView: true,
          referer: request.headers.get('referer') || 'direct',
          userAgent: userAgent.substring(0, 200) // Limit size
        },
        userAgent,
        ipAddress
      );
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    if (pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};