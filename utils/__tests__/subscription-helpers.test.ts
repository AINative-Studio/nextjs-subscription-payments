/**
 * Tests for utils/subscription-helpers.ts
 * Tests formatting, validation, and utility functions
 */

import {
  formatPrice,
  formatInterval,
  getSubscriptionStatus,
  isSubscriptionActive,
  calculateNextBillingDate,
  willCancelAtPeriodEnd,
  getSubscriptionProductName,
  formatSubscriptionPrice,
} from '../subscription-helpers';

describe('formatPrice()', () => {
  it('formats currency correctly in USD', () => {
    const result = formatPrice(1000, 'usd');
    expect(result).toBe('$10');
  });

  it('formats currency correctly in EUR', () => {
    const result = formatPrice(2500, 'eur');
    expect(result).toBe('€25');
  });

  it('handles zero amount', () => {
    const result = formatPrice(0, 'usd');
    expect(result).toBe('$0');
  });

  it('handles null amount', () => {
    const result = formatPrice(null, 'usd');
    expect(result).toBe('$0.00');
  });

  it('handles undefined amount', () => {
    const result = formatPrice(undefined, 'usd');
    expect(result).toBe('$0.00');
  });

  it('handles null currency', () => {
    const result = formatPrice(1000, null);
    expect(result).toBe('$0.00');
  });

  it('handles undefined currency', () => {
    const result = formatPrice(1000, undefined);
    expect(result).toBe('$0.00');
  });

  it('rounds to no decimal places', () => {
    const result = formatPrice(1099, 'usd');
    expect(result).toBe('$11');
  });
});

describe('formatInterval()', () => {
  it('displays monthly interval', () => {
    const result = formatInterval('month', 1);
    expect(result).toBe('month');
  });

  it('displays yearly interval', () => {
    const result = formatInterval('year', 1);
    expect(result).toBe('year');
  });

  it('displays plural for multiple months', () => {
    const result = formatInterval('month', 3);
    expect(result).toBe('3 months');
  });

  it('displays plural for multiple years', () => {
    const result = formatInterval('year', 2);
    expect(result).toBe('2 years');
  });

  it('handles null interval', () => {
    const result = formatInterval(null);
    expect(result).toBe('');
  });

  it('handles undefined interval', () => {
    const result = formatInterval(undefined);
    expect(result).toBe('');
  });

  it('handles null interval count', () => {
    const result = formatInterval('month', null);
    expect(result).toBe('month');
  });

  it('handles undefined interval count', () => {
    const result = formatInterval('month', undefined);
    expect(result).toBe('month');
  });
});

describe('getSubscriptionStatus()', () => {
  it('returns correct status for active', () => {
    const result = getSubscriptionStatus('active');
    expect(result).toBe('Active');
  });

  it('returns correct status for trialing', () => {
    const result = getSubscriptionStatus('trialing');
    expect(result).toBe('Trial');
  });

  it('returns correct status for canceled', () => {
    const result = getSubscriptionStatus('canceled');
    expect(result).toBe('Canceled');
  });

  it('returns correct status for past_due', () => {
    const result = getSubscriptionStatus('past_due');
    expect(result).toBe('Past Due');
  });

  it('handles null status', () => {
    const result = getSubscriptionStatus(null);
    expect(result).toBe('Unknown');
  });

  it('handles undefined status', () => {
    const result = getSubscriptionStatus(undefined);
    expect(result).toBe('Unknown');
  });

  it('returns original value for unknown status', () => {
    const result = getSubscriptionStatus('custom_status');
    expect(result).toBe('custom_status');
  });
});

describe('isSubscriptionActive()', () => {
  it('returns true for active status', () => {
    const result = isSubscriptionActive('active');
    expect(result).toBe(true);
  });

  it('returns true for trialing status', () => {
    const result = isSubscriptionActive('trialing');
    expect(result).toBe(true);
  });

  it('returns false for canceled status', () => {
    const result = isSubscriptionActive('canceled');
    expect(result).toBe(false);
  });

  it('returns false for incomplete status', () => {
    const result = isSubscriptionActive('incomplete');
    expect(result).toBe(false);
  });

  it('handles null status', () => {
    const result = isSubscriptionActive(null);
    expect(result).toBe(false);
  });

  it('handles undefined status', () => {
    const result = isSubscriptionActive(undefined);
    expect(result).toBe(false);
  });
});

describe('calculateNextBillingDate()', () => {
  it('computes date correctly from ISO string', () => {
    const result = calculateNextBillingDate('2025-01-15T00:00:00Z');
    expect(result).toBeTruthy();
    expect(result).toContain('2025');
  });

  it('handles null date', () => {
    const result = calculateNextBillingDate(null);
    expect(result).toBe(null);
  });

  it('handles undefined date', () => {
    const result = calculateNextBillingDate(undefined);
    expect(result).toBe(null);
  });

  it('handles invalid date string', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const result = calculateNextBillingDate('invalid-date');
    expect(result).toBe(null);
    consoleErrorSpy.mockRestore();
  });

  it('formats date in long format', () => {
    const result = calculateNextBillingDate('2025-12-25T00:00:00Z');
    expect(result).toContain('December');
    expect(result).toContain('25');
    expect(result).toContain('2025');
  });
});

describe('willCancelAtPeriodEnd()', () => {
  it('returns true when cancel_at_period_end is true', () => {
    const result = willCancelAtPeriodEnd({ cancel_at_period_end: true });
    expect(result).toBe(true);
  });

  it('returns false when cancel_at_period_end is false', () => {
    const result = willCancelAtPeriodEnd({ cancel_at_period_end: false });
    expect(result).toBe(false);
  });

  it('returns false when cancel_at_period_end is null', () => {
    const result = willCancelAtPeriodEnd({ cancel_at_period_end: null });
    expect(result).toBe(false);
  });

  it('returns false when cancel_at_period_end is undefined', () => {
    const result = willCancelAtPeriodEnd({});
    expect(result).toBe(false);
  });
});

describe('getSubscriptionProductName()', () => {
  it('returns product name from nested data', () => {
    const subscription = {
      prices: {
        products: {
          name: 'Premium Plan',
        },
      },
    };
    const result = getSubscriptionProductName(subscription);
    expect(result).toBe('Premium Plan');
  });

  it('returns "No subscription" for null subscription', () => {
    const result = getSubscriptionProductName(null);
    expect(result).toBe('No subscription');
  });

  it('returns "No subscription" for undefined subscription', () => {
    const result = getSubscriptionProductName(undefined);
    expect(result).toBe('No subscription');
  });

  it('returns "Unknown" when product name is missing', () => {
    const subscription = {
      prices: {
        products: {},
      },
    };
    const result = getSubscriptionProductName(subscription);
    expect(result).toBe('Unknown');
  });

  it('returns "Unknown" when prices is missing', () => {
    const subscription = {};
    const result = getSubscriptionProductName(subscription);
    expect(result).toBe('Unknown');
  });

  it('handles error gracefully', () => {
    const subscription = {
      prices: null,
    };
    const result = getSubscriptionProductName(subscription);
    expect(result).toBe('Unknown');
  });
});

describe('formatSubscriptionPrice()', () => {
  it('formats price with interval', () => {
    const subscription = {
      prices: {
        unit_amount: 1000,
        currency: 'usd',
        interval: 'month',
      },
    };
    const result = formatSubscriptionPrice(subscription);
    expect(result).toBe('$10/month');
  });

  it('formats price without interval', () => {
    const subscription = {
      prices: {
        unit_amount: 5000,
        currency: 'usd',
      },
    };
    const result = formatSubscriptionPrice(subscription);
    expect(result).toBe('$50');
  });

  it('returns "N/A" for null subscription', () => {
    const result = formatSubscriptionPrice(null);
    expect(result).toBe('N/A');
  });

  it('returns "N/A" for undefined subscription', () => {
    const result = formatSubscriptionPrice(undefined);
    expect(result).toBe('N/A');
  });

  it('returns "N/A" when prices is missing', () => {
    const subscription = {};
    const result = formatSubscriptionPrice(subscription);
    expect(result).toBe('N/A');
  });

  it('formats with yearly interval', () => {
    const subscription = {
      prices: {
        unit_amount: 10000,
        currency: 'usd',
        interval: 'year',
      },
    };
    const result = formatSubscriptionPrice(subscription);
    expect(result).toBe('$100/year');
  });
});

describe('Edge Cases', () => {
  it('formatPrice handles large amounts', () => {
    const result = formatPrice(1000000, 'usd');
    expect(result).toBe('$10,000');
  });

  it('formatInterval handles day interval', () => {
    const result = formatInterval('day', 7);
    expect(result).toBe('7 days');
  });

  it('formatInterval handles week interval', () => {
    const result = formatInterval('week', 2);
    expect(result).toBe('2 weeks');
  });

  it('isSubscriptionActive handles paused status', () => {
    const result = isSubscriptionActive('paused');
    expect(result).toBe(false);
  });

  it('getSubscriptionStatus handles incomplete_expired', () => {
    const result = getSubscriptionStatus('incomplete_expired');
    expect(result).toBe('Incomplete (Expired)');
  });

  it('calculateNextBillingDate handles timezone', () => {
    const result = calculateNextBillingDate('2025-06-15T14:30:00+05:00');
    expect(result).toBeTruthy();
  });
});
