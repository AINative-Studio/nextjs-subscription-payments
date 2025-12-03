/**
 * Tests for OAuth callback route
 */

import { GET } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Mock dependencies
jest.mock('@/utils/supabase/server');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Auth Callback Route', () => {
  let mockExchangeCodeForSession: jest.Mock;
  let mockGetURL: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExchangeCodeForSession = jest.fn();
    mockGetURL = jest.fn((path: string) => `http://localhost:3000${path}`);

    mockCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    } as any);

    // Mock next/navigation redirect
    jest.mock('next/navigation', () => ({
      redirect: jest.fn((url) => {
        throw { redirect: url };
      }),
    }));
  });

  describe('Successful OAuth Callback', () => {
    it('should exchange code for session successfully', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=oauth_code_123');

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token_123' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: 'http://localhost:3000/',
      });

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('oauth_code_123');
    });

    it('should redirect to home page after successful exchange', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=valid_code');

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('/'),
      });
    });

    it('should handle next parameter for redirect', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=code_123&next=/dashboard'
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('dashboard'),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing code parameter', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback');

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('error'),
      });

      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('should handle invalid code', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=invalid_code');

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid code' },
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('error'),
      });
    });

    it('should handle session exchange error', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=error_code');

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Exchange failed', code: 'session_error' },
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('error'),
      });
    });

    it('should handle network errors', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=network_error');

      mockExchangeCodeForSession.mockRejectedValue(new Error('Network error'));

      await expect(GET(request)).rejects.toThrow();
    });
  });

  describe('Query Parameters', () => {
    it('should extract code from query string', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=extracted_code&state=random_state'
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('extracted_code');
    });

    it('should handle multiple query parameters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=code_123&provider=google&state=xyz'
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });
    });

    it('should handle encoded query parameters', async () => {
      const encodedCode = encodeURIComponent('code/with/special+chars');
      const request = new NextRequest(
        `http://localhost:3000/auth/callback?code=${encodedCode}`
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });
    });
  });

  describe('Redirect Logic', () => {
    it('should preserve next parameter in successful redirect', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=code_123&next=/account'
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('account'),
      });
    });

    it('should default to home page when next is not provided', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=code_123');

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: 'http://localhost:3000/',
      });
    });

    it('should sanitize next parameter to prevent open redirect', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=code_123&next=https://evil.com'
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      // Should redirect to local path only
      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.not.stringContaining('evil.com'),
      });
    });
  });

  describe('OAuth Provider Specific', () => {
    it('should handle GitHub OAuth callback', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=github_code&provider=github'
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token', provider_token: 'github_token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });
    });

    it('should handle Google OAuth callback', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=google_code&provider=google'
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code parameter', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=');

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('error'),
      });
    });

    it('should handle malformed URL', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code');

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.stringContaining('error'),
      });
    });

    it('should handle very long code parameter', async () => {
      const longCode = 'a'.repeat(1000);
      const request = new NextRequest(
        `http://localhost:3000/auth/callback?code=${longCode}`
      );

      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith(longCode);
    });
  });

  describe('Session Management', () => {
    it('should create session with user data', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=code_123');

      mockExchangeCodeForSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'token_123',
            refresh_token: 'refresh_123',
            user: {
              id: 'user_123',
              email: 'user@example.com',
            },
          },
        },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });
    });

    it('should handle session without refresh token', async () => {
      const request = new NextRequest('http://localhost:3000/auth/callback?code=code_123');

      mockExchangeCodeForSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'token_123',
            user: { id: 'user_123' },
          },
        },
        error: null,
      });

      await expect(GET(request)).rejects.toMatchObject({
        redirect: expect.any(String),
      });
    });
  });
});
