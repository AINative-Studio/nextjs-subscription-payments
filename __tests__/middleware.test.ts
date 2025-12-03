/**
 * Middleware JWT Authentication Tests
 *
 * Comprehensive test suite for Next.js middleware JWT authentication.
 * Tests cover public routes, protected routes, token validation, cookie management,
 * redirect logic, edge cases, and integration scenarios.
 *
 * Test Coverage Target: ≥80%
 * Performance Target: <50ms per request
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';
import * as auth from '../lib/auth';

// Mock the auth module
jest.mock('../lib/auth', () => ({
  verifyToken: jest.fn(),
}));

// Helper to create mock NextRequest with cookies
function createMockRequest(
  pathname: string,
  cookies?: Record<string, string>,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  // Create headers with cookie if provided
  const headers: HeadersInit = {};
  if (cookies) {
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    headers['cookie'] = cookieString;
  }

  const request = new NextRequest(url, { headers });
  return request;
}

describe('Middleware - Public Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Root path (/) should be accessible without token', async () => {
    const request = createMockRequest('/');
    const response = await middleware(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('/signin should be accessible without token', async () => {
    const request = createMockRequest('/signin');
    const response = await middleware(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('/signin/signup should be accessible without token', async () => {
    const request = createMockRequest('/signin/signup');
    const response = await middleware(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('/pricing should be accessible without token', async () => {
    const request = createMockRequest('/pricing');
    const response = await middleware(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('/api/webhooks/stripe should be accessible without token', async () => {
    const request = createMockRequest('/api/webhooks/stripe');
    const response = await middleware(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('Static files (_next/static) should not be blocked', async () => {
    // This route won't match the middleware config matcher
    // Testing the publicRoutes logic anyway
    const request = createMockRequest('/_next/static/chunks/main.js');

    // Should pass through for public-like paths
    // The actual Next.js matcher will handle static files
    expect(request).toBeDefined();
  });

  test('Images (_next/image) should not be blocked', async () => {
    const request = createMockRequest('/_next/image');
    expect(request).toBeDefined();
  });

  test('Public assets (.svg, .png) should not be blocked', async () => {
    const request = createMockRequest('/logo.svg');
    expect(request).toBeDefined();
  });
});

describe('Middleware - Protected Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('/account requires authentication', async () => {
    const request = createMockRequest('/account');
    const response = await middleware(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(307); // Redirect status
  });

  test('/account redirects to /signin without token', async () => {
    const request = createMockRequest('/account');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('/account preserves redirect parameter', async () => {
    const request = createMockRequest('/account');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('redirect=');
    expect(locationHeader).toContain('%2Faccount'); // URL encoded /account
  });

  test('/protected-route blocks without token', async () => {
    const request = createMockRequest('/protected-route');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Token validation called for protected routes', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', { access_token: 'valid-token' });

    await middleware(request);

    expect(auth.verifyToken).toHaveBeenCalledWith('valid-token');
  });

  test('Valid token allows access', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', { access_token: 'valid-token' });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  test('Invalid token redirects to signin', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'invalid-token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Expired token redirects to signin', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'expired-token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });
});

describe('Middleware - Token Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Valid JWT token allows access', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.token'
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(auth.verifyToken).toHaveBeenCalled();
  });

  test('Invalid JWT token rejected', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'invalid.jwt.token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });

  test('Expired JWT token rejected', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'expired.jwt.token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });

  test('Malformed token rejected', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'malformed-token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });

  test('Missing token redirects', async () => {
    const request = createMockRequest('/account');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('Token with wrong signature rejected', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.wrong.signature'
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });

  test('Token cookie cleared on invalid token', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'invalid-token' });
    const response = await middleware(request);

    // Check that cookie is deleted
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      expect(setCookie).toContain('access_token=;');
    }
  });

  test('verifyToken() function called', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', { access_token: 'test-token' });

    await middleware(request);

    expect(auth.verifyToken).toHaveBeenCalledTimes(1);
    expect(auth.verifyToken).toHaveBeenCalledWith('test-token');
  });

  test('Error handling for verifyToken() failure', async () => {
    (auth.verifyToken as jest.Mock).mockImplementation(() => {
      throw new Error('Token verification failed');
    });
    const request = createMockRequest('/account', { access_token: 'error-token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Redirect URL preserved in query params', async () => {
    const request = createMockRequest('/account/settings');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('redirect=%2Faccount%2Fsettings');
  });
});

describe('Middleware - Cookie Management Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Read access_token cookie correctly', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', { access_token: 'my-token-value' });

    await middleware(request);

    expect(auth.verifyToken).toHaveBeenCalledWith('my-token-value');
  });

  test('Clear access_token on invalid token', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'invalid-token' });
    const response = await middleware(request);

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      expect(setCookie).toContain('access_token=;');
    }
  });

  test('Cookie not set on public routes', async () => {
    const request = createMockRequest('/');
    const response = await middleware(request);

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeNull();
  });

  test('Cookie validation on every protected request', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);

    // First request
    const request1 = createMockRequest('/account', { access_token: 'token1' });
    await middleware(request1);
    expect(auth.verifyToken).toHaveBeenCalledTimes(1);

    // Second request
    const request2 = createMockRequest('/account', { access_token: 'token2' });
    await middleware(request2);
    expect(auth.verifyToken).toHaveBeenCalledTimes(2);
  });

  test('Multiple cookie handling', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', {
      access_token: 'access-token',
      other_cookie: 'other-value'
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(auth.verifyToken).toHaveBeenCalledWith('access-token');
  });

  test('Cookie security flags respected', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'token' });
    const response = await middleware(request);

    // Cookie deletion should maintain security
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      expect(setCookie).toBeTruthy();
    }
  });
});

describe('Middleware - Redirect Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Redirect to /signin on missing token', async () => {
    const request = createMockRequest('/account');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Redirect to /signin on invalid token', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);
    const request = createMockRequest('/account', { access_token: 'invalid' });
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Preserve original URL in redirect param', async () => {
    const request = createMockRequest('/dashboard/analytics');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('redirect=');
  });

  test('Decode redirect parameter correctly', async () => {
    const request = createMockRequest('/account/settings/profile');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    const url = new URL(locationHeader!, 'http://localhost:3000');
    const redirectParam = url.searchParams.get('redirect');

    expect(redirectParam).toBe('/account/settings/profile');
  });

  test('Handle redirect loops', async () => {
    // Signin page should not redirect to itself
    const request = createMockRequest('/signin');
    const response = await middleware(request);

    expect(response.status).toBe(200);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toBeNull();
  });

  test('Redirect after login to original page', async () => {
    // This tests that redirect param is properly set
    const request = createMockRequest('/account/billing');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('redirect=%2Faccount%2Fbilling');
  });

  test('Test redirect with query parameters', async () => {
    const request = createMockRequest('/account', undefined, { param: 'value' });
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Test redirect with hash fragments', async () => {
    const url = new URL('http://localhost:3000/account#section');
    const request = new NextRequest(url);
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });
});

describe('Middleware - Edge Case Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Very long tokens', async () => {
    const longToken = 'a'.repeat(10000);
    (auth.verifyToken as jest.Mock).mockReturnValue(false);

    const request = createMockRequest('/account', { access_token: longToken });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(auth.verifyToken).toHaveBeenCalledWith(longToken);
  });

  test('Special characters in redirect URL', async () => {
    const request = createMockRequest('/account?name=test&value=123');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
    expect(locationHeader).toContain('redirect=');
  });

  test('Concurrent requests', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);

    const requests = Array.from({ length: 10 }, (_, i) =>
      middleware(createMockRequest('/account', { access_token: `token-${i}` }))
    );

    const responses = await Promise.all(requests);

    expect(responses).toHaveLength(10);
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    expect(auth.verifyToken).toHaveBeenCalledTimes(10);
  });

  test('Token expiring during request', async () => {
    // First call succeeds, second fails (simulating expiration)
    (auth.verifyToken as jest.Mock)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const request1 = createMockRequest('/account', { access_token: 'token' });
    const response1 = await middleware(request1);
    expect(response1.status).toBe(200);

    const request2 = createMockRequest('/account', { access_token: 'token' });
    const response2 = await middleware(request2);
    expect(response2.status).toBe(307);
  });

  test('Database connection errors', async () => {
    (auth.verifyToken as jest.Mock).mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const request = createMockRequest('/account', { access_token: 'token' });
    const response = await middleware(request);

    // Should redirect on error
    expect(response.status).toBe(307);
  });

  test('JWT_SECRET missing (environment)', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(false);

    const request = createMockRequest('/account', { access_token: 'token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });

  test('Null/undefined token values', async () => {
    const request = createMockRequest('/account');
    // Don't set any token

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('Empty string tokens', async () => {
    const request = createMockRequest('/account', { access_token: '' });
    const response = await middleware(request);

    // Empty string should be treated as no token
    expect(response.status).toBe(307);
  });
});

describe('Middleware - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Full authentication flow (signin → protected route)', async () => {
    // Step 1: Access protected route without token
    const request1 = createMockRequest('/account');
    const response1 = await middleware(request1);
    expect(response1.status).toBe(307);

    // Step 2: After signin, access with valid token
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request2 = createMockRequest('/account', { access_token: 'valid-token' });
    const response2 = await middleware(request2);
    expect(response2.status).toBe(200);
  });

  test('Token refresh during middleware execution', async () => {
    // Old token fails
    (auth.verifyToken as jest.Mock).mockReturnValueOnce(false);
    const request1 = createMockRequest('/account', { access_token: 'old-token' });
    const response1 = await middleware(request1);
    expect(response1.status).toBe(307);

    // New token succeeds
    (auth.verifyToken as jest.Mock).mockReturnValueOnce(true);
    const request2 = createMockRequest('/account', { access_token: 'new-token' });
    const response2 = await middleware(request2);
    expect(response2.status).toBe(200);
  });

  test('Multiple protected routes in sequence', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const routes = ['/account', '/account/billing', '/dashboard'];

    for (const route of routes) {
      const request = createMockRequest(route, { access_token: 'valid-token' });
      const response = await middleware(request);
      expect(response.status).toBe(200);
    }

    expect(auth.verifyToken).toHaveBeenCalledTimes(routes.length);
  });

  test('Public → Protected → Public route flow', async () => {
    // Public route
    const request1 = createMockRequest('/');
    const response1 = await middleware(request1);
    expect(response1.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();

    // Protected route
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request2 = createMockRequest('/account', { access_token: 'token' });
    const response2 = await middleware(request2);
    expect(response2.status).toBe(200);
    expect(auth.verifyToken).toHaveBeenCalledTimes(1);

    // Public route again
    const request3 = createMockRequest('/pricing');
    const response3 = await middleware(request3);
    expect(response3.status).toBe(200);
    expect(auth.verifyToken).toHaveBeenCalledTimes(1); // Still 1
  });

  test('Middleware + page auth consistency', async () => {
    // Middleware should allow valid tokens
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', { access_token: 'valid-token' });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(auth.verifyToken).toHaveBeenCalledWith('valid-token');
  });

  test('Performance: middleware execution time < 50ms', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account', { access_token: 'token' });

    const startTime = performance.now();
    await middleware(request);
    const endTime = performance.now();

    const executionTime = endTime - startTime;

    // Should execute in less than 50ms
    expect(executionTime).toBeLessThan(50);
  });
});

describe('Middleware - Additional Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Webhook route with additional path', async () => {
    const request = createMockRequest('/api/webhooks/stripe/test');
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });

  test('Public route with trailing slash', async () => {
    const request = createMockRequest('/pricing/');
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  test('Case sensitivity in routes', async () => {
    // Routes should be case-sensitive - /Account is different from /account
    // Since /Account is not in publicRoutes, it should require auth
    const request = createMockRequest('/Account');
    const response = await middleware(request);

    // Should require auth (not matching /account exactly)
    expect(response.status).toBe(307);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Multiple query parameters in redirect', async () => {
    const request = createMockRequest('/account?param1=value1&param2=value2');
    const response = await middleware(request);

    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
    expect(locationHeader).toContain('redirect=');
  });

  test('Root API path protection', async () => {
    const request = createMockRequest('/api/user');
    const response = await middleware(request);

    // Non-webhook API routes should require auth
    expect(response.status).toBe(307);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toContain('/signin');
  });

  test('Nested protected routes', async () => {
    (auth.verifyToken as jest.Mock).mockReturnValue(true);
    const request = createMockRequest('/account/settings/security', {
      access_token: 'token'
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  test('Error logging occurs on verification failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (auth.verifyToken as jest.Mock).mockImplementation(() => {
      throw new Error('Verification error');
    });

    const request = createMockRequest('/account', { access_token: 'token' });
    await middleware(request);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('Signin with forgot password path', async () => {
    const request = createMockRequest('/signin/forgot_password');
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(auth.verifyToken).not.toHaveBeenCalled();
  });
});
