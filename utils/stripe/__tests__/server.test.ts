/**
 * Tests for Stripe server utilities
 */

import { calculateTrialEndUnixTimestamp, getErrorRedirect, checkoutWithStripe, createStripePortal } from '../server';
import { stripe } from '../config';
import { getURL } from '@/utils/helpers';

// Mock dependencies
jest.mock('../config');
jest.mock('@/utils/helpers', () => {
  const actual = jest.requireActual('@/utils/helpers');
  return {
    ...actual,
    getURL: jest.fn(),
  };
});
jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({
    get: jest.fn((key: string) => {
      if (key === 'x-user-id') return 'user-123';
      if (key === 'x-user-email') return 'test@example.com';
      return null;
    }),
  })),
}));
jest.mock('@/lib/zerodb', () => ({
  query: jest.fn(),
}));

const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockGetURL = getURL as jest.MockedFunction<typeof getURL>;
const mockQuery = require('@/lib/zerodb').query as jest.MockedFunction<any>;

describe('Stripe Server Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetURL.mockImplementation((path) => `http://localhost:3000${path || ''}`);

    // Mock database query for customer lookup
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT stripe_customer_id')) {
        return Promise.resolve({ rows: [{ stripe_customer_id: 'cus_123' }] });
      }
      if (sql.includes('UPDATE users SET stripe_customer_id')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    // Mock Stripe customer create
    if (mockStripe.customers && mockStripe.customers.create) {
      (mockStripe.customers.create as jest.Mock).mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
      });
    }
  });

  describe('calculateTrialEndUnixTimestamp', () => {
    it('should calculate trial end date for given days', () => {
      const trialDays = 7;
      const result = calculateTrialEndUnixTimestamp(trialDays);

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + trialDays);

      // Allow 1 second tolerance for test execution time
      expect(result).toBeCloseTo(Math.floor(expectedDate.getTime() / 1000), -1);
    });

    it('should handle 30 day trial period', () => {
      const result = calculateTrialEndUnixTimestamp(30);
      const now = Math.floor(Date.now() / 1000);
      const thirtyDays = 30 * 24 * 60 * 60;

      expect(result).toBeGreaterThan(now);
      expect(result).toBeLessThanOrEqual(now + thirtyDays + 10);
    });

    it('should handle 0 days trial', () => {
      const result = calculateTrialEndUnixTimestamp(0);
      const now = Math.floor(Date.now() / 1000);

      // Should be today
      expect(result).toBeCloseTo(now, -2);
    });

    it('should handle 1 day trial', () => {
      const result = calculateTrialEndUnixTimestamp(1);
      const now = Math.floor(Date.now() / 1000);
      const oneDay = 24 * 60 * 60;

      expect(result).toBeGreaterThan(now);
      expect(result).toBeLessThanOrEqual(now + oneDay + 10);
    });

    it('should return unix timestamp', () => {
      const result = calculateTrialEndUnixTimestamp(14);

      // Unix timestamp should be a positive number
      expect(result).toBeGreaterThan(0);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('getErrorRedirect', () => {
    it('should create error redirect URL with encoded parameters', () => {
      const result = getErrorRedirect('/signin', 'AuthError', 'Invalid credentials');

      expect(result).toContain('/signin');
      expect(result).toContain('error=AuthError');
      expect(result).toContain('error_description=Invalid%20credentials');
    });

    it('should handle special characters in error message', () => {
      const result = getErrorRedirect('/signin', 'Error', 'Failed: user@example.com');

      expect(result).toContain('error=Error');
      expect(result).toContain('error_description=Failed');
    });

    it('should preserve existing query parameters', () => {
      const result = getErrorRedirect('/signin?redirect=/dashboard', 'Error', 'Message');

      expect(result).toContain('/signin');
      expect(result).toContain('error=Error');
    });

    it('should handle empty error description', () => {
      const result = getErrorRedirect('/signin', 'UnknownError', '');

      expect(result).toContain('error=UnknownError');
      expect(result).toContain('error_description=');
    });
  });

  describe('checkoutWithStripe', () => {
    const mockPrice = {
      id: 'price_123',
      product_id: 'prod_123',
      active: true,
      currency: 'usd',
      type: 'recurring' as const,
      unit_amount: 1999,
      interval: 'month' as const,
      interval_count: 1,
      trial_period_days: 14,
      description: null,
      metadata: {},
    };

    const mockCurrentPath = '/pricing';

    it('should create checkout session for valid price', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/session123',
      };

      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      const result = await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(result.sessionId).toBe('cs_test_123');
      expect(result.errorRedirect).toBeUndefined();

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{
            price: 'price_123',
            quantity: 1,
          }],
        })
      );
    });

    it('should include trial period when specified', async () => {
      const mockSession = { id: 'cs_test_123' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: expect.objectContaining({
            trial_end: expect.any(Number),
          }),
        })
      );
    });

    it('should not include trial for one-time payments', async () => {
      const oneTimePrice = {
        ...mockPrice,
        type: 'one_time' as const,
        trial_period_days: null,
      };

      const mockSession = { id: 'cs_test_123' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(oneTimePrice, mockCurrentPath);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
        })
      );
    });

    it('should include success and cancel URLs', async () => {
      const mockSession = { id: 'cs_test_123' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: expect.stringContaining('/account'),
          cancel_url: expect.stringContaining('/pricing'),
        })
      );
    });

    it('should handle Stripe API errors', async () => {
      mockStripe.checkout.sessions.create.mockRejectedValue(
        new Error('Stripe API error')
      );

      const result = await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(result.errorRedirect).toContain('error');
      expect(result.sessionId).toBeUndefined();
    });

    it('should handle network errors', async () => {
      mockStripe.checkout.sessions.create.mockRejectedValue(
        new Error('Network error')
      );

      const result = await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(result.errorRedirect).toBeDefined();
      expect(result.sessionId).toBeUndefined();
    });

    it('should set correct mode for recurring prices', async () => {
      const mockSession = { id: 'cs_test_123' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
        })
      );
    });

    it('should allow promotion codes', async () => {
      const mockSession = { id: 'cs_test_123' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          allow_promotion_codes: true,
        })
      );
    });

    it('should collect billing address', async () => {
      const mockSession = { id: 'cs_test_123' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(mockPrice, mockCurrentPath);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_address_collection: 'required',
        })
      );
    });
  });

  describe('createStripePortal', () => {
    const mockCustomerId = 'cus_123';

    it('should create billing portal session', async () => {
      const mockSession = {
        id: 'bps_123',
        url: 'https://billing.stripe.com/session/abc123',
      };

      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession as any);

      const result = await createStripePortal(mockCustomerId);

      expect(result).toBe('https://billing.stripe.com/session/abc123');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: expect.stringContaining('/account'),
      });
    });

    it('should include return URL', async () => {
      const mockSession = {
        url: 'https://billing.stripe.com/session/abc123',
      };

      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession as any);

      await createStripePortal(mockCustomerId);

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: expect.any(String),
        })
      );
    });

    it('should handle Stripe API errors', async () => {
      mockStripe.billingPortal.sessions.create.mockRejectedValue(
        new Error('Customer not found')
      );

      await expect(createStripePortal(mockCustomerId)).rejects.toThrow('Customer not found');
    });

    it('should handle missing customer ID', async () => {
      mockStripe.billingPortal.sessions.create.mockRejectedValue(
        new Error('No customer ID provided')
      );

      await expect(createStripePortal('')).rejects.toThrow();
    });

    it('should return valid URL', async () => {
      const mockSession = {
        url: 'https://billing.stripe.com/session/valid123',
      };

      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession as any);

      const result = await createStripePortal(mockCustomerId);

      expect(result).toMatch(/^https?:\/\//);
      expect(result).toContain('billing.stripe.com');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large trial periods', () => {
      const result = calculateTrialEndUnixTimestamp(365);
      const now = Math.floor(Date.now() / 1000);
      const oneYear = 365 * 24 * 60 * 60;

      expect(result).toBeGreaterThan(now);
      expect(result).toBeLessThanOrEqual(now + oneYear + 100);
    });

    it('should handle negative trial days gracefully', () => {
      const result = calculateTrialEndUnixTimestamp(-1);
      const now = Math.floor(Date.now() / 1000);

      // Should handle negative values (might return past date)
      expect(typeof result).toBe('number');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(1000);
      const result = getErrorRedirect('/signin', 'Error', longMessage);

      expect(result).toContain('error=Error');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle special characters in redirect path', () => {
      const result = getErrorRedirect('/path?param=value&other=123', 'Error', 'Message');

      expect(result).toContain('error=Error');
    });
  });

  describe('Currency Handling', () => {
    it('should handle different currencies in checkout', async () => {
      const eurPrice = {
        id: 'price_eur',
        product_id: 'prod_123',
        active: true,
        currency: 'eur',
        type: 'recurring' as const,
        unit_amount: 1999,
        interval: 'month' as const,
        interval_count: 1,
        trial_period_days: null,
        description: null,
        metadata: {},
      };

      const mockSession = { id: 'cs_test_eur' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(eurPrice, '/pricing');

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: expect.arrayContaining([
            expect.objectContaining({
              price: 'price_eur',
            }),
          ]),
        })
      );
    });

    it('should handle GBP currency', async () => {
      const gbpPrice = {
        id: 'price_gbp',
        product_id: 'prod_123',
        active: true,
        currency: 'gbp',
        type: 'recurring' as const,
        unit_amount: 1599,
        interval: 'month' as const,
        interval_count: 1,
        trial_period_days: null,
        description: null,
        metadata: {},
      };

      const mockSession = { id: 'cs_test_gbp' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      const result = await checkoutWithStripe(gbpPrice, '/pricing');

      expect(result.sessionId).toBe('cs_test_gbp');
    });
  });

  describe('Interval Handling', () => {
    it('should handle yearly subscriptions', async () => {
      const yearlyPrice = {
        id: 'price_yearly',
        product_id: 'prod_123',
        active: true,
        currency: 'usd',
        type: 'recurring' as const,
        unit_amount: 19999,
        interval: 'year' as const,
        interval_count: 1,
        trial_period_days: null,
        description: null,
        metadata: {},
      };

      const mockSession = { id: 'cs_test_yearly' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await checkoutWithStripe(yearlyPrice, '/pricing');

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{
            price: 'price_yearly',
            quantity: 1,
          }],
        })
      );
    });

    it('should handle weekly subscriptions', async () => {
      const weeklyPrice = {
        id: 'price_weekly',
        product_id: 'prod_123',
        active: true,
        currency: 'usd',
        type: 'recurring' as const,
        unit_amount: 499,
        interval: 'week' as const,
        interval_count: 1,
        trial_period_days: null,
        description: null,
        metadata: {},
      };

      const mockSession = { id: 'cs_test_weekly' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      const result = await checkoutWithStripe(weeklyPrice, '/pricing');

      expect(result.sessionId).toBe('cs_test_weekly');
    });
  });
});
