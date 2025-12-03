import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/signin',
    '/signin/signup',
    '/signin/forgot_password',
    '/pricing',
    '/api/webhooks/stripe',
    '/api/webhooks'
  ];

  // Check if current route is public
  // For root path, exact match only
  // For others, check if path starts with route + '/'  or equals route
  const isPublicRoute = publicRoutes.some(route => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname === route || pathname.startsWith(route + '/');
  });

  // Skip auth check for public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Get JWT token from cookies
  const token = request.cookies.get('access_token')?.value;

  // Redirect to signin if no token
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Verify JWT token
  try {
    const isValid = verifyToken(token);

    if (!isValid) {
      // Token is invalid or expired - clear cookie and redirect
      const url = request.nextUrl.clone();
      url.pathname = '/signin';
      url.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(url);
      response.cookies.delete('access_token');
      return response;
    }

    // Token is valid - allow request to proceed
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware auth error:', error);

    // On error, clear token and redirect to signin
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(url);
    response.cookies.delete('access_token');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
