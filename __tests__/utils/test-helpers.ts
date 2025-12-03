/**
 * Test Helper Utilities
 * Shared utilities for test setup and teardown
 */

import { QueryResult } from 'pg';

/**
 * Mock query result factory
 */
export function createMockQueryResult<T = any>(
  rows: T[] = [],
  rowCount: number | null = null
): QueryResult<T> {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

/**
 * Mock user factory
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    full_name: 'Test User',
    avatar_url: null,
    billing_address: null,
    payment_method: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock customer factory
 */
export function createMockCustomer(overrides: Partial<any> = {}) {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    stripe_customer_id: 'cus_test123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock product factory
 */
export function createMockProduct(overrides: Partial<any> = {}) {
  return {
    id: 'prod_test123',
    active: true,
    name: 'Test Product',
    description: 'A test product',
    image: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock price factory
 */
export function createMockPrice(overrides: Partial<any> = {}) {
  return {
    id: 'price_test123',
    product_id: 'prod_test123',
    active: true,
    description: 'Monthly subscription',
    unit_amount: 1000,
    currency: 'usd',
    type: 'recurring',
    interval: 'month',
    interval_count: 1,
    trial_period_days: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock subscription factory
 */
export function createMockSubscription(overrides: Partial<any> = {}) {
  return {
    id: 'sub_test123',
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    status: 'active',
    metadata: {},
    price_id: 'price_test123',
    quantity: 1,
    cancel_at_period_end: false,
    created: new Date().toISOString(),
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ended_at: null,
    cancel_at: null,
    canceled_at: null,
    trial_start: null,
    trial_end: null,
    ...overrides,
  };
}

/**
 * Mock JWT token factory
 */
export function createMockJWT(payload: any = {}) {
  const defaultPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };

  return {
    token: 'mock.jwt.token',
    payload: defaultPayload,
  };
}

/**
 * Wait for a promise to resolve or reject
 */
export async function waitFor(callback: () => any, timeout = 1000): Promise<any> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const result = callback();
      if (result) return result;
    } catch (error) {
      // Continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Mock Next.js request
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}) {
  const {
    method = 'GET',
    url = 'http://localhost:3000',
    headers = {},
    body = null,
  } = options;

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : null,
  });
}

/**
 * Mock Next.js response
 */
export function createMockResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Suppress console errors/warnings in tests
 */
export function suppressConsole() {
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
}
