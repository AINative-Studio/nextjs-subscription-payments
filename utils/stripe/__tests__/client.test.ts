/**
 * Tests for Stripe client-side utilities
 */

import { getStripe } from '../client';
import { loadStripe } from '@stripe/stripe-js';

// Mock @stripe/stripe-js
jest.mock('@stripe/stripe-js');

const mockLoadStripe = loadStripe as jest.MockedFunction<typeof loadStripe>;

describe('Stripe Client Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the module to clear any cached stripe promise
    jest.resetModules();
  });

  describe('getStripe', () => {
    it('should call loadStripe with publishable key', async () => {
      const mockStripe = {} as any;
      mockLoadStripe.mockResolvedValue(mockStripe);

      await getStripe();

      expect(mockLoadStripe).toHaveBeenCalledWith(
        expect.any(String)
      );
    });

    it('should return stripe promise', async () => {
      const mockStripe = {} as any;
      mockLoadStripe.mockResolvedValue(mockStripe);

      const result = await getStripe();

      expect(result).toBe(mockStripe);
    });

    it('should cache stripe promise', async () => {
      const mockStripe = {} as any;
      mockLoadStripe.mockResolvedValue(mockStripe);

      // Call getStripe multiple times
      const promise1 = getStripe();
      const promise2 = getStripe();
      const promise3 = getStripe();

      // Should be the same promise instance
      expect(promise1).toBe(promise2);
      expect(promise2).toBe(promise3);

      // loadStripe should only be called once
      expect(mockLoadStripe).toHaveBeenCalledTimes(1);
    });

    it('should handle loadStripe returning null', async () => {
      mockLoadStripe.mockResolvedValue(null);

      const result = await getStripe();

      expect(result).toBeNull();
    });

    it('should use NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from env', async () => {
      const mockStripe = {} as any;
      mockLoadStripe.mockResolvedValue(mockStripe);

      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_12345';

      await getStripe();

      expect(mockLoadStripe).toHaveBeenCalledWith(
        expect.stringContaining('pk_test')
      );
    });
  });
});
