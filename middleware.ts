import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Protected routes that require authentication
const protectedPaths = ['/account', '/api/subscription'];

// Public routes that don't require authentication
const publicPaths = [
  '/',
  '/signin',
  '/signin/signup',
  '/signin/forgot_password',
  '/signup',
  '/pricing',
  '/api/webhooks/stripe',
  '/api/webhooks'
];

interface JWTPayload {
  userId: string;
  email: string;
  exp: number;
  iat?: number;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if current route is public
  // For root path, exact match only
  // For others, check if path starts with route + '/' or equals route
  const isPublicRoute = publicPaths.some(route => {
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

  try {
    // Verify JWT token and decode payload
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if token is about to expire (within 1 hour)
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    if (expiresIn > 0 && expiresIn < 3600) {
      // Token expires soon, refresh it
      const newToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const response = NextResponse.next();
      response.cookies.set('access_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });

      // Add user info to headers
      response.headers.set('x-user-id', decoded.userId);
      response.headers.set('x-user-email', decoded.email);

      return response;
    }

    // Token is valid, add user info to request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', decoded.userId);
    requestHeaders.set('x-user-email', decoded.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    console.error('JWT verification failed:', error);

    // Invalid or expired token, clear cookie and redirect to signin
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
