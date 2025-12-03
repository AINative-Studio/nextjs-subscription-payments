/**
 * Tests for Stripe configuration
 */

import { stripe } from '../config';

describe('Stripe Configuration', () => {
  it('should export stripe instance', () => {
    expect(stripe).toBeDefined();
  });

  it('should be instance of Stripe', () => {
    expect(stripe.constructor.name).toBe('Stripe');
  });

  it('should have correct API methods', () => {
    expect(stripe.customers).toBeDefined();
    expect(stripe.subscriptions).toBeDefined();
    expect(stripe.products).toBeDefined();
    expect(stripe.prices).toBeDefined();
    expect(stripe.webhooks).toBeDefined();
  });

  it('should have app info configured', () => {
    // Access the private property through type assertion
    const stripeAny = stripe as any;
    expect(stripeAny._appInfo).toBeDefined();
    expect(stripeAny._appInfo.name).toBe('Next.js Subscription Starter');
  });
});
