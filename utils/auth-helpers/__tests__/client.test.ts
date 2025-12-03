/**
 * Tests for client-side auth helpers
 */

import { handleRequest, signInWithOAuth } from '../client';
import { redirectToPath } from '../server';

// Mock the dependencies
jest.mock('@/utils/supabase/client');
jest.mock('../server');
jest.mock('@/utils/helpers');

const mockRouterPush = jest.fn();
const mockRouter = {
  push: mockRouterPush,
} as any;

describe('Client Auth Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleRequest', () => {
    it('should prevent default form submission', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: new FormData() as any,
      } as React.FormEvent<HTMLFormElement>;

      const requestFunc = jest.fn().mockResolvedValue('/redirect-url');

      await handleRequest(mockEvent, requestFunc, mockRouter);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should call requestFunc with form data', async () => {
      const mockFormData = new FormData();
      mockFormData.append('email', 'test@example.com');

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: {
          elements: [],
          checkValidity: jest.fn(),
          reportValidity: jest.fn(),
        } as any,
      } as React.FormEvent<HTMLFormElement>;

      // Override currentTarget to return our mock FormData
      Object.defineProperty(mockEvent, 'currentTarget', {
        value: mockFormData,
        writable: false,
      });

      const requestFunc = jest.fn().mockResolvedValue('/redirect-url');

      await handleRequest(mockEvent, requestFunc, mockRouter);

      expect(requestFunc).toHaveBeenCalledWith(expect.any(FormData));
    });

    it('should use router.push when router is provided', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: new FormData() as any,
      } as React.FormEvent<HTMLFormElement>;

      const requestFunc = jest.fn().mockResolvedValue('/dashboard');

      await handleRequest(mockEvent, requestFunc, mockRouter);

      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should use redirectToPath when router is null', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: new FormData() as any,
      } as React.FormEvent<HTMLFormElement>;

      const requestFunc = jest.fn().mockResolvedValue('/dashboard');
      (redirectToPath as jest.Mock).mockResolvedValue(undefined);

      await handleRequest(mockEvent, requestFunc, null);

      expect(redirectToPath).toHaveBeenCalledWith('/dashboard');
    });

    it('should handle async requestFunc', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: new FormData() as any,
      } as React.FormEvent<HTMLFormElement>;

      const requestFunc = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve('/delayed-redirect'), 100))
      );

      await handleRequest(mockEvent, requestFunc, mockRouter);

      expect(requestFunc).toHaveBeenCalled();
      expect(mockRouterPush).toHaveBeenCalledWith('/delayed-redirect');
    });

    it('should return void when using redirectToPath', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: new FormData() as any,
      } as React.FormEvent<HTMLFormElement>;

      const requestFunc = jest.fn().mockResolvedValue('/dashboard');
      (redirectToPath as jest.Mock).mockResolvedValue(undefined);

      const result = await handleRequest(mockEvent, requestFunc, null);

      expect(result).toBeUndefined();
    });
  });

  describe('signInWithOAuth', () => {
    const mockSignInWithOAuth = jest.fn();
    const mockCreateClient = jest.fn(() => ({
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
      },
    }));

    beforeEach(() => {
      const supabaseClient = require('@/utils/supabase/client');
      supabaseClient.createClient = mockCreateClient;

      const helpers = require('@/utils/helpers');
      helpers.getURL = jest.fn((path) => `http://localhost:3000${path}`);
    });

    it('should prevent default form submission', async () => {
      const mockFormData = new FormData();
      mockFormData.append('provider', 'google');

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: mockFormData as any,
      } as React.FormEvent<HTMLFormElement>;

      await signInWithOAuth(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should extract provider from form data', async () => {
      const mockFormData = new FormData();
      mockFormData.append('provider', 'github');

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: mockFormData as any,
      } as React.FormEvent<HTMLFormElement>;

      await signInWithOAuth(mockEvent);

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      });
    });

    it('should trim provider value', async () => {
      const mockFormData = new FormData();
      mockFormData.append('provider', '  google  ');

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: mockFormData as any,
      } as React.FormEvent<HTMLFormElement>;

      await signInWithOAuth(mockEvent);

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      });
    });

    it('should use correct redirect URL', async () => {
      const mockFormData = new FormData();
      mockFormData.append('provider', 'google');

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: mockFormData as any,
      } as React.FormEvent<HTMLFormElement>;

      await signInWithOAuth(mockEvent);

      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {
            redirectTo: expect.stringContaining('/auth/callback'),
          },
        })
      );
    });

    it('should create supabase client', async () => {
      const mockFormData = new FormData();
      mockFormData.append('provider', 'google');

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: mockFormData as any,
      } as React.FormEvent<HTMLFormElement>;

      await signInWithOAuth(mockEvent);

      expect(mockCreateClient).toHaveBeenCalled();
    });

    it('should handle different OAuth providers', async () => {
      const providers = ['google', 'github', 'gitlab', 'facebook'];

      for (const provider of providers) {
        mockSignInWithOAuth.mockClear();

        const mockFormData = new FormData();
        mockFormData.append('provider', provider);

        const mockEvent = {
          preventDefault: jest.fn(),
          currentTarget: mockFormData as any,
        } as React.FormEvent<HTMLFormElement>;

        await signInWithOAuth(mockEvent);

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider,
          options: {
            redirectTo: expect.any(String),
          },
        });
      }
    });
  });
});
