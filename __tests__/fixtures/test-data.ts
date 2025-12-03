/**
 * Test data fixtures for consistent testing across the application
 */

import { Tables } from '@/types_db';

type User = {
  id: string;
  email: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  aud: string;
  created_at: string;
};

type Product = Tables<'products'>;
type Price = Tables<'prices'>;
type Customer = Tables<'customers'>;
type Subscription = Tables<'subscriptions'>;

/**
 * Test Users
 */
export const TEST_USERS = {
  basic: {
    id: 'user_basic_123',
    email: 'basic@example.com',
    app_metadata: {},
    user_metadata: { name: 'Basic User' },
    aud: 'authenticated',
    created_at: '2023-01-01T00:00:00Z',
  } as User,

  premium: {
    id: 'user_premium_456',
    email: 'premium@example.com',
    app_metadata: {},
    user_metadata: { name: 'Premium User' },
    aud: 'authenticated',
    created_at: '2023-01-01T00:00:00Z',
  } as User,

  enterprise: {
    id: 'user_enterprise_789',
    email: 'enterprise@example.com',
    app_metadata: {},
    user_metadata: { name: 'Enterprise User' },
    aud: 'authenticated',
    created_at: '2023-01-01T00:00:00Z',
  } as User,
};

/**
 * Test Products
 */
export const TEST_PRODUCTS: Product[] = [
  {
    id: 'prod_basic_plan',
    active: true,
    name: 'Basic Plan',
    description: 'Perfect for individuals getting started',
    image: 'https://example.com/images/basic.jpg',
    metadata: { features: 'basic' },
  },
  {
    id: 'prod_premium_plan',
    active: true,
    name: 'Premium Plan',
    description: 'For professionals who need more',
    image: 'https://example.com/images/premium.jpg',
    metadata: { features: 'premium', popular: 'true' },
  },
  {
    id: 'prod_enterprise_plan',
    active: true,
    name: 'Enterprise Plan',
    description: 'For large teams and organizations',
    image: null,
    metadata: { features: 'enterprise' },
  },
];

/**
 * Test Prices
 */
export const TEST_PRICES: Price[] = [
  // Basic Plan - Monthly
  {
    id: 'price_basic_monthly',
    product_id: 'prod_basic_plan',
    active: true,
    currency: 'usd',
    type: 'recurring',
    unit_amount: 999,
    interval: 'month',
    interval_count: 1,
    trial_period_days: 7,
    description: 'Basic Plan - Monthly',
    metadata: {},
  },
  // Basic Plan - Yearly
  {
    id: 'price_basic_yearly',
    product_id: 'prod_basic_plan',
    active: true,
    currency: 'usd',
    type: 'recurring',
    unit_amount: 9999,
    interval: 'year',
    interval_count: 1,
    trial_period_days: 14,
    description: 'Basic Plan - Yearly',
    metadata: { save: '20%' },
  },
  // Premium Plan - Monthly
  {
    id: 'price_premium_monthly',
    product_id: 'prod_premium_plan',
    active: true,
    currency: 'usd',
    type: 'recurring',
    unit_amount: 1999,
    interval: 'month',
    interval_count: 1,
    trial_period_days: 14,
    description: 'Premium Plan - Monthly',
    metadata: {},
  },
  // Premium Plan - Yearly
  {
    id: 'price_premium_yearly',
    product_id: 'prod_premium_plan',
    active: true,
    currency: 'usd',
    type: 'recurring',
    unit_amount: 19999,
    interval: 'year',
    interval_count: 1,
    trial_period_days: 30,
    description: 'Premium Plan - Yearly',
    metadata: { save: '25%' },
  },
  // Enterprise Plan - Monthly
  {
    id: 'price_enterprise_monthly',
    product_id: 'prod_enterprise_plan',
    active: true,
    currency: 'usd',
    type: 'recurring',
    unit_amount: 4999,
    interval: 'month',
    interval_count: 1,
    trial_period_days: 30,
    description: 'Enterprise Plan - Monthly',
    metadata: {},
  },
  // One-time addon
  {
    id: 'price_addon_onetime',
    product_id: 'prod_basic_plan',
    active: true,
    currency: 'usd',
    type: 'one_time',
    unit_amount: 2999,
    interval: null,
    interval_count: null,
    trial_period_days: null,
    description: 'One-time Add-on',
    metadata: {},
  },
];

/**
 * Test Customers
 */
export const TEST_CUSTOMERS: Customer[] = [
  {
    id: 'cus_basic_123',
    stripe_customer_id: 'cus_stripe_basic_123',
  },
  {
    id: 'cus_premium_456',
    stripe_customer_id: 'cus_stripe_premium_456',
  },
  {
    id: 'cus_enterprise_789',
    stripe_customer_id: 'cus_stripe_enterprise_789',
  },
];

/**
 * Test Subscriptions
 */
export const TEST_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub_active_123',
    user_id: 'user_basic_123',
    status: 'active',
    metadata: {},
    price_id: 'price_basic_monthly',
    quantity: 1,
    cancel_at_period_end: false,
    created: '2023-01-01',
    current_period_start: '2023-01-01',
    current_period_end: '2023-02-01',
    ended_at: null,
    cancel_at: null,
    canceled_at: null,
    trial_start: null,
    trial_end: null,
  },
  {
    id: 'sub_trialing_456',
    user_id: 'user_premium_456',
    status: 'trialing',
    metadata: {},
    price_id: 'price_premium_monthly',
    quantity: 1,
    cancel_at_period_end: false,
    created: '2023-01-01',
    current_period_start: '2023-01-01',
    current_period_end: '2023-02-01',
    ended_at: null,
    cancel_at: null,
    canceled_at: null,
    trial_start: '2023-01-01',
    trial_end: '2023-01-14',
  },
  {
    id: 'sub_canceled_789',
    user_id: 'user_enterprise_789',
    status: 'canceled',
    metadata: {},
    price_id: 'price_enterprise_monthly',
    quantity: 1,
    cancel_at_period_end: false,
    created: '2023-01-01',
    current_period_start: '2023-01-01',
    current_period_end: '2023-02-01',
    ended_at: '2023-03-01',
    cancel_at: '2023-03-01',
    canceled_at: '2023-02-15',
    trial_start: null,
    trial_end: null,
  },
];

/**
 * Test Stripe Webhooks
 */
export const TEST_STRIPE_EVENTS = {
  productCreated: {
    type: 'product.created',
    data: {
      object: {
        id: 'prod_webhook_test',
        object: 'product',
        active: true,
        name: 'Webhook Test Product',
        description: 'Created via webhook',
        images: [],
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890,
      },
    },
  },

  priceCreated: {
    type: 'price.created',
    data: {
      object: {
        id: 'price_webhook_test',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_webhook_test',
        type: 'recurring',
        unit_amount: 1499,
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
        metadata: {},
        created: 1234567890,
        livemode: false,
      },
    },
  },

  customerCreated: {
    type: 'customer.created',
    data: {
      object: {
        id: 'cus_webhook_test',
        object: 'customer',
        email: 'webhook@example.com',
        metadata: { user_id: 'user_webhook_123' },
        created: 1234567890,
        livemode: false,
      },
    },
  },

  subscriptionCreated: {
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_webhook_test',
        object: 'subscription',
        customer: 'cus_webhook_test',
        status: 'active',
        items: {
          data: [{
            id: 'si_test',
            price: {
              id: 'price_webhook_test',
            },
          }],
        },
        current_period_start: 1234567890,
        current_period_end: 1237159890,
        cancel_at_period_end: false,
        metadata: {},
        created: 1234567890,
        livemode: false,
      },
    },
  },

  checkoutSessionCompleted: {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_webhook_test',
        object: 'checkout.session',
        customer: 'cus_webhook_test',
        subscription: 'sub_webhook_test',
        mode: 'subscription',
        status: 'complete',
        metadata: { user_id: 'user_webhook_123' },
        created: 1234567890,
        livemode: false,
      },
    },
  },
};

/**
 * Helper function to create custom test user
 */
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    ...TEST_USERS.basic,
    ...overrides,
  };
}

/**
 * Helper function to create custom test product
 */
export function createTestProduct(overrides: Partial<Product> = {}): Product {
  return {
    ...TEST_PRODUCTS[0],
    ...overrides,
  };
}

/**
 * Helper function to create custom test price
 */
export function createTestPrice(overrides: Partial<Price> = {}): Price {
  return {
    ...TEST_PRICES[0],
    ...overrides,
  };
}

/**
 * Helper function to create custom test subscription
 */
export function createTestSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    ...TEST_SUBSCRIPTIONS[0],
    ...overrides,
  };
}

/**
 * Mock form data
 */
export function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

/**
 * Mock form event
 */
export function createMockFormEvent(
  formData: Record<string, string> = {}
): React.FormEvent<HTMLFormElement> {
  const mockFormData = createMockFormData(formData);
  return {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    currentTarget: mockFormData as any,
    target: mockFormData as any,
  } as any;
}
