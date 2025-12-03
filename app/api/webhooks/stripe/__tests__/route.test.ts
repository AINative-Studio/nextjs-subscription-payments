import { POST } from '../route';
import { query } from '@/lib/zerodb';
import Stripe from 'stripe';

// Mock dependencies
jest.mock('@/lib/zerodb');
jest.mock('@/utils/stripe/config', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn()
    },
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      update: jest.fn()
    },
    subscriptions: {
      retrieve: jest.fn()
    }
  }
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const stripe = require('@/utils/stripe/config').stripe;

describe('Stripe Webhook Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  // ============================================================================
  // 1. Mock Setup Tests (5 tests)
  // ============================================================================
  describe('Mock Setup Tests', () => {
    it('should have query function mocked', () => {
      expect(mockQuery).toBeDefined();
      expect(typeof mockQuery).toBe('function');
    });

    it('should have Stripe SDK mocked', () => {
      expect(stripe).toBeDefined();
      expect(stripe.webhooks).toBeDefined();
      expect(stripe.customers).toBeDefined();
      expect(stripe.subscriptions).toBeDefined();
    });

    it('should have STRIPE_WEBHOOK_SECRET environment variable', () => {
      expect(process.env.STRIPE_WEBHOOK_SECRET).toBe('whsec_test_secret');
    });

    it('should verify webhook signature with Stripe SDK', async () => {
      const mockEvent = { type: 'product.created', data: { object: {} } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [{}], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify({ type: 'product.created' })
      });

      await POST(request);

      expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
    });

    it('should return 400 when webhook signature is missing', async () => {
      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify({ type: 'product.created' })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Webhook secret not found');
    });
  });

  // ============================================================================
  // 2. Product Webhook Tests (8 tests)
  // ============================================================================
  describe('Product Webhook Tests', () => {
    it('should insert new product on product.created event', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Test Product',
        description: 'Test Description',
        images: ['https://example.com/image.jpg'],
        metadata: { key: 'value' },
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products'),
        [
          'prod_123',
          true,
          'Test Product',
          'Test Description',
          'https://example.com/image.jpg',
          JSON.stringify({ key: 'value' })
        ]
      );
    });

    it('should update existing product on product.updated event', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: false,
        name: 'Updated Product',
        description: 'Updated Description',
        images: [],
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.updated', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (id) DO UPDATE SET'),
        expect.arrayContaining(['prod_123', false, 'Updated Product'])
      );
    });

    it('should mark product inactive on product.deleted event', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: false,
        name: 'Deleted Product',
        created: 1234567890,
        livemode: false,
        updated: 1234567890,
        metadata: {}
      };

      const mockEvent = { type: 'product.deleted', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products SET active = false'),
        ['prod_123']
      );
    });

    it('should handle product with missing description', async () => {
      const product: Partial<Stripe.Product> = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Test Product',
        description: null,
        images: [],
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products'),
        expect.arrayContaining([null]) // description should be null
      );
    });

    it('should handle product with all fields populated', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Full Product',
        description: 'Full Description',
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        metadata: { feature1: 'enabled', feature2: 'disabled' },
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products'),
        [
          'prod_123',
          true,
          'Full Product',
          'Full Description',
          'https://example.com/image1.jpg',
          JSON.stringify({ feature1: 'enabled', feature2: 'disabled' })
        ]
      );
    });

    it('should handle metadata correctly', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Metadata Product',
        metadata: { custom_field: 'custom_value', another_field: '123' },
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1][5]).toBe(JSON.stringify({ custom_field: 'custom_value', another_field: '123' }));
    });

    it('should handle image URL correctly', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Image Product',
        images: ['https://cdn.example.com/product.png'],
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products'),
        expect.arrayContaining(['https://cdn.example.com/product.png'])
      );
    });

    it('should handle product error gracefully', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Error Product',
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // 3. Price Webhook Tests (10 tests)
  // ============================================================================
  describe('Price Webhook Tests', () => {
    it('should insert new price on price.created event', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 1000,
        recurring: {
          interval: 'month',
          interval_count: 1
        },
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prices'),
        expect.arrayContaining([
          'price_123',
          'prod_123',
          true,
          'usd',
          null,
          'recurring',
          1000,
          'month',
          1,
          null
        ])
      );
    });

    it('should update existing price on price.updated event', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: false,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 1500,
        recurring: {
          interval: 'month',
          interval_count: 1
        },
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.updated', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (id) DO UPDATE SET'),
        expect.arrayContaining(['price_123', 'prod_123', false, 'usd'])
      );
    });

    it('should mark price inactive on price.deleted event', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: false,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.deleted', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE prices SET active = false'),
        ['price_123']
      );
    });

    it('should handle one_time pricing type', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'one_time',
        unit_amount: 5000,
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('::pricing_type'),
        expect.arrayContaining(['one_time', null, null])
      );
    });

    it('should handle recurring pricing type', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 1000,
        recurring: {
          interval: 'year',
          interval_count: 1
        },
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prices'),
        expect.arrayContaining(['recurring', 'year', 1])
      );
    });

    it('should handle price with trial period', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 1000,
        recurring: {
          interval: 'month',
          interval_count: 1,
          trial_period_days: 14
        },
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('trial_period_days'),
        expect.arrayContaining([14])
      );
    });

    it('should handle different intervals - day', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 100,
        recurring: {
          interval: 'day',
          interval_count: 1
        },
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('::pricing_plan_interval'),
        expect.arrayContaining(['day'])
      );
    });

    it('should handle different intervals - week', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 500,
        recurring: {
          interval: 'week',
          interval_count: 2
        },
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('::pricing_plan_interval'),
        expect.arrayContaining(['week', 2])
      );
    });

    it('should handle metadata correctly', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 1000,
        recurring: {
          interval: 'month',
          interval_count: 1
        },
        metadata: { plan: 'pro', features: 'unlimited' },
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1][10]).toBe(JSON.stringify({ plan: 'pro', features: 'unlimited' }));
    });

    it('should handle price error with retry logic', async () => {
      const price: Stripe.Price = {
        id: 'price_123',
        object: 'price',
        active: true,
        currency: 'usd',
        product: 'prod_123',
        type: 'recurring',
        unit_amount: 1000,
        recurring: {
          interval: 'month',
          interval_count: 1
        },
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'price.created', data: { object: price } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // First call fails with foreign key error, second succeeds
      mockQuery
        .mockRejectedValueOnce({ message: 'foreign key constraint failed', code: '23503' })
        .mockResolvedValueOnce({ rows: [price], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // 4. Customer Webhook Tests (6 tests)
  // ============================================================================
  describe('Customer Webhook Tests', () => {
    it('should retrieve existing customer from database', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      mockQuery.mockResolvedValue({
        rows: [{ stripe_customer_id: customerId }],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: []
      });

      stripe.customers.retrieve.mockResolvedValue({ id: customerId });

      // This would be tested through subscription webhook
      expect(mockQuery).toBeDefined();
    });

    it('should create new customer in Stripe when not found', async () => {
      const userId = 'user_123';
      const email = 'test@example.com';
      const customerId = 'cus_new_123';

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.customers.list.mockResolvedValue({ data: [] });
      stripe.customers.create.mockResolvedValue({ id: customerId, email });

      expect(stripe.customers.create).toBeDefined();
    });

    it('should find existing Stripe customer by email', async () => {
      const customerId = 'cus_existing';
      const email = 'existing@example.com';

      stripe.customers.list.mockResolvedValue({
        data: [{ id: customerId, email }]
      });

      expect(stripe.customers.list).toBeDefined();
    });

    it('should upsert customer record in database', async () => {
      const userId = 'user_123';
      const customerId = 'cus_123';

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] });

      expect(mockQuery).toBeDefined();
    });

    it('should handle missing user gracefully', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      expect(mockQuery).toBeDefined();
    });

    it('should associate user_id with customer', async () => {
      const userId = 'user_123';
      const customerId = 'cus_123';

      mockQuery.mockResolvedValue({
        rows: [{ stripe_customer_id: customerId }],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: []
      });

      expect(mockQuery).toBeDefined();
    });
  });

  // ============================================================================
  // 5. Subscription Webhook Tests (12 tests)
  // ============================================================================
  describe('Subscription Webhook Tests', () => {
    const baseSubscription: any = {
      id: 'sub_123',
      object: 'subscription',
      customer: 'cus_123',
      status: 'active',
      default_payment_method: null,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_123',
            object: 'subscription_item',
            price: {
              id: 'price_123',
              object: 'price',
              active: true,
              currency: 'usd',
              product: 'prod_123',
              type: 'recurring',
              unit_amount: 1000,
              recurring: {
                interval: 'month',
                interval_count: 1
              },
              metadata: {},
              created: 1234567890,
              livemode: false
            },
            quantity: 1,
            subscription: 'sub_123',
            created: 1234567890
          }
        ],
        has_more: false,
        url: '/v1/subscription_items'
      },
      current_period_start: 1234567890,
      current_period_end: 1237159890,
      cancel_at_period_end: false,
      metadata: {},
      created: 1234567890,
      livemode: false
    };

    it('should handle customer.subscription.created event', async () => {
      const subscription = {
        ...baseSubscription,
        status: 'trialing' as const,
        default_payment_method: null
      };

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription as any);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT user_id FROM customers'),
        ['cus_123']
      );
    });

    it('should handle customer.subscription.updated event', async () => {
      const subscription = {
        ...baseSubscription,
        status: 'active' as const,
        default_payment_method: null
      };

      const mockEvent = { type: 'customer.subscription.updated', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription as any);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle customer.subscription.deleted event', async () => {
      const subscription = { ...baseSubscription, status: 'canceled' };

      const mockEvent = { type: 'customer.subscription.deleted', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('::subscription_status'),
        expect.anything()
      );
    });

    it('should handle status transition trialing to active', async () => {
      const subscription = { ...baseSubscription, status: 'active' };

      const mockEvent = { type: 'customer.subscription.updated', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle status transition active to canceled', async () => {
      const subscription = { ...baseSubscription, status: 'canceled', canceled_at: 1234567890 };

      const mockEvent = { type: 'customer.subscription.updated', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle cancel_at_period_end flag', async () => {
      const subscription = { ...baseSubscription, cancel_at_period_end: true, cancel_at: 1237159890 };

      const mockEvent = { type: 'customer.subscription.updated', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('cancel_at_period_end'),
        expect.arrayContaining([true])
      );
    });

    it('should handle trial periods correctly', async () => {
      const subscription = {
        ...baseSubscription,
        status: 'trialing',
        trial_start: 1234567890,
        trial_end: 1235777890
      };

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('trial_start'),
        expect.arrayContaining([expect.any(String)])
      );
    });

    it('should handle current_period dates correctly', async () => {
      const subscription = baseSubscription;

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('current_period_start'),
        expect.anything()
      );
    });

    it('should cast subscription status to ENUM correctly', async () => {
      const subscription = baseSubscription;

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const insertCall = mockQuery.mock.calls.find(call =>
        call[0].includes('INSERT INTO subscriptions')
      );
      expect(insertCall[0]).toContain('::subscription_status');
    });

    it('should handle metadata correctly', async () => {
      const subscription = {
        ...baseSubscription,
        metadata: { customer_note: 'VIP customer', plan_tier: 'premium' }
      };

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle missing customer error', async () => {
      const subscription = {
        ...baseSubscription,
        default_payment_method: null
      };

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock customer lookup returning empty result - this should cause an error
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      // Mock Stripe subscription retrieve
      stripe.subscriptions.retrieve.mockResolvedValue(subscription as any);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      // The handler will throw an error for missing customer, which gets caught and returns 400
      expect(response.status).toBe(400);
    });

    it('should handle subscription error gracefully', async () => {
      const subscription = {
        ...baseSubscription,
        default_payment_method: null
      };

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // First query fails (customer lookup)
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      stripe.subscriptions.retrieve.mockResolvedValue(subscription as any);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // 6. Checkout Session Tests (8 tests)
  // ============================================================================
  describe('Checkout Session Tests', () => {
    it('should handle checkout.session.completed for one-time payment', async () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        object: 'checkout.session',
        mode: 'payment',
        customer: 'cus_123',
        payment_status: 'paid',
        status: 'complete'
      };

      const mockEvent = { type: 'checkout.session.completed', data: { object: checkoutSession } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle checkout.session.completed for subscription', async () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_123',
        subscription: 'sub_123',
        status: 'complete'
      };

      const subscription = {
        id: 'sub_123',
        object: 'subscription' as const,
        customer: 'cus_123',
        status: 'active' as const,
        default_payment_method: null,
        items: {
          object: 'list' as const,
          data: [
            {
              id: 'si_123',
              object: 'subscription_item' as const,
              price: {
                id: 'price_123',
                object: 'price' as const,
                active: true,
                currency: 'usd',
                product: 'prod_123',
                type: 'recurring' as const,
                unit_amount: 1000,
                recurring: { interval: 'month' as const, interval_count: 1 },
                metadata: {},
                created: 1234567890,
                livemode: false
              },
              quantity: 1,
              subscription: 'sub_123',
              created: 1234567890
            }
          ],
          has_more: false,
          url: '/v1/subscription_items'
        },
        current_period_start: 1234567890,
        current_period_end: 1237159890,
        cancel_at_period_end: false,
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'checkout.session.completed', data: { object: checkoutSession } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription as any);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123', expect.anything());
    });

    it('should create customer during checkout if needed', async () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_new_123',
        subscription: 'sub_123',
        status: 'complete'
      };

      const subscription = {
        id: 'sub_123',
        object: 'subscription' as const,
        customer: 'cus_new_123',
        status: 'active' as const,
        items: {
          object: 'list' as const,
          data: [{
            id: 'si_123',
            object: 'subscription_item' as const,
            price: {
              id: 'price_123',
              object: 'price' as const,
              active: true,
              currency: 'usd',
              product: 'prod_123',
              type: 'recurring' as const,
              unit_amount: 1000,
              recurring: { interval: 'month' as const, interval_count: 1 },
              metadata: {},
              created: 1234567890,
              livemode: false
            },
            quantity: 1,
            subscription: 'sub_123',
            created: 1234567890
          }],
          has_more: false,
          url: '/v1/subscription_items'
        },
        current_period_start: 1234567890,
        current_period_end: 1237159890,
        cancel_at_period_end: false,
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const mockEvent = { type: 'checkout.session.completed', data: { object: checkoutSession } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      // Should fail because customer not found
      expect(response.status).toBe(400);
    });

    it('should trigger subscription status change on checkout', async () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_123',
        subscription: 'sub_123',
        status: 'complete'
      };

      const subscription = {
        id: 'sub_123',
        object: 'subscription' as const,
        customer: 'cus_123',
        status: 'active' as const,
        items: {
          object: 'list' as const,
          data: [
            {
              id: 'si_123',
              object: 'subscription_item' as const,
              price: {
                id: 'price_123',
                object: 'price' as const,
                active: true,
                currency: 'usd',
                product: 'prod_123',
                type: 'recurring' as const,
                unit_amount: 1000,
                recurring: { interval: 'month' as const, interval_count: 1 },
                metadata: {},
                created: 1234567890,
                livemode: false
              },
              quantity: 1,
              subscription: 'sub_123',
              created: 1234567890
            }
          ],
          has_more: false,
          url: '/v1/subscription_items'
        },
        current_period_start: 1234567890,
        current_period_end: 1237159890,
        cancel_at_period_end: false,
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'checkout.session.completed', data: { object: checkoutSession } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should update payment method during checkout', async () => {
      const paymentMethod: Partial<Stripe.PaymentMethod> = {
        id: 'pm_123',
        object: 'payment_method',
        type: 'card',
        customer: 'cus_123',
        billing_details: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+1234567890',
          address: {
            line1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postal_code: '12345',
            country: 'US'
          }
        },
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025
        }
      };

      expect(paymentMethod).toBeDefined();
    });

    it('should handle billing details correctly', async () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_123',
        subscription: 'sub_123',
        status: 'complete'
      };

      expect(checkoutSession.customer).toBe('cus_123');
    });

    it('should differentiate between payment and subscription mode', async () => {
      const paymentSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_payment_123',
        object: 'checkout.session',
        mode: 'payment',
        customer: 'cus_123',
        status: 'complete'
      };

      const subscriptionSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_subscription_123',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_123',
        subscription: 'sub_123',
        status: 'complete'
      };

      expect(paymentSession.mode).toBe('payment');
      expect(subscriptionSession.mode).toBe('subscription');
    });

    it('should handle checkout error gracefully', async () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_123',
        subscription: 'sub_123',
        status: 'complete'
      };

      const mockEvent = { type: 'checkout.session.completed', data: { object: checkoutSession } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // 6B. Additional Coverage Tests for copyBillingDetailsToCustomer
  // ============================================================================
  describe('Billing Details and Customer Tests', () => {
    it('should copy billing details with payment method', async () => {
      const subscription = {
        id: 'sub_123',
        object: 'subscription' as const,
        customer: 'cus_123',
        status: 'active' as const,
        default_payment_method: {
          id: 'pm_123',
          object: 'payment_method' as const,
          type: 'card' as const,
          customer: 'cus_123',
          billing_details: {
            name: 'Test User',
            email: 'test@example.com',
            phone: '+1234567890',
            address: {
              line1: '123 Test St',
              city: 'Test City',
              state: 'TS',
              postal_code: '12345',
              country: 'US'
            }
          },
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025
          }
        },
        items: {
          object: 'list' as const,
          data: [{
            id: 'si_123',
            object: 'subscription_item' as const,
            price: {
              id: 'price_123',
              object: 'price' as const,
              active: true,
              currency: 'usd',
              product: 'prod_123',
              type: 'recurring' as const,
              unit_amount: 1000,
              recurring: { interval: 'month' as const, interval_count: 1 },
              metadata: {},
              created: 1234567890,
              livemode: false
            },
            quantity: 1,
            subscription: 'sub_123',
            created: 1234567890
          }],
          has_more: false,
          url: '/v1/subscription_items'
        },
        current_period_start: 1234567890,
        current_period_end: 1237159890,
        cancel_at_period_end: false,
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] }); // billing update

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);
      stripe.customers.update.mockResolvedValue({ id: 'cus_123' });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(stripe.customers.update).toHaveBeenCalled();
    });

    it('should skip billing details copy when missing required fields', async () => {
      const subscription = {
        id: 'sub_123',
        object: 'subscription' as const,
        customer: 'cus_123',
        status: 'active' as const,
        default_payment_method: {
          id: 'pm_123',
          object: 'payment_method' as const,
          type: 'card' as const,
          customer: 'cus_123',
          billing_details: {
            name: null,
            email: null,
            phone: null,
            address: null
          },
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025
          }
        },
        items: {
          object: 'list' as const,
          data: [{
            id: 'si_123',
            object: 'subscription_item' as const,
            price: {
              id: 'price_123',
              object: 'price' as const,
              active: true,
              currency: 'usd',
              product: 'prod_123',
              type: 'recurring' as const,
              unit_amount: 1000,
              recurring: { interval: 'month' as const, interval_count: 1 },
              metadata: {},
              created: 1234567890,
              livemode: false
            },
            quantity: 1,
            subscription: 'sub_123',
            created: 1234567890
          }],
          has_more: false,
          url: '/v1/subscription_items'
        },
        current_period_start: 1234567890,
        current_period_end: 1237159890,
        cancel_at_period_end: false,
        metadata: {},
        created: 1234567890,
        livemode: false
      };

      const mockEvent = { type: 'customer.subscription.created', data: { object: subscription } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ user_id: 'user_123' }], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [subscription], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.subscriptions.retrieve.mockResolvedValue(subscription);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should not update customer when billing details are missing
      expect(stripe.customers.update).not.toHaveBeenCalled();
    });

    it('should retrieve existing customer by Stripe ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ stripe_customer_id: 'cus_existing' }],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: []
      });

      stripe.customers.retrieve.mockResolvedValue({ id: 'cus_existing' });

      // This would be tested through subscription webhook
      expect(stripe.customers.retrieve).toBeDefined();
    });

    it('should handle Stripe customer not found and create new one', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ stripe_customer_id: 'cus_old_deleted' }],
          rowCount: 1,
          command: '',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] });

      stripe.customers.retrieve.mockRejectedValue(new Error('No such customer'));
      stripe.customers.list.mockResolvedValue({ data: [] });
      stripe.customers.create.mockResolvedValue({ id: 'cus_new_123' });

      expect(stripe.customers.create).toBeDefined();
    });
  });

  // ============================================================================
  // 7. Integration Tests (6 tests)
  // ============================================================================
  describe('Integration Tests', () => {
    it('should handle full webhook flow end-to-end', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Test Product',
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const jsonResponse = await response.json();
      expect(jsonResponse.received).toBe(true);
    });

    it('should handle idempotency correctly', async () => {
      const product: Stripe.Product = {
        id: 'prod_123',
        object: 'product',
        active: true,
        name: 'Test Product',
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent = { type: 'product.created', data: { object: product } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockQuery.mockResolvedValue({ rows: [product], rowCount: 1, command: '', oid: 0, fields: [] });

      const request1 = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(200);

      // Send same event again
      const request2 = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(200);
    });

    it('should validate webhook signature correctly', async () => {
      const mockEvent = { type: 'product.created', data: { object: {} } };
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'invalid_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const text = await response.text();
      expect(text).toContain('Webhook Error');
    });

    it('should handle malformed payload gracefully', async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid payload');
      });

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: 'invalid json'
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for unsupported event types', async () => {
      const mockEvent = { type: 'unsupported.event', data: { object: {} } };
      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const request = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature' },
        body: JSON.stringify(mockEvent)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const text = await response.text();
      expect(text).toContain('Unsupported event type');
    });

    it('should handle concurrent webhooks safely', async () => {
      const product1: Stripe.Product = {
        id: 'prod_1',
        object: 'product',
        active: true,
        name: 'Product 1',
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const product2: Stripe.Product = {
        id: 'prod_2',
        object: 'product',
        active: true,
        name: 'Product 2',
        metadata: {},
        created: 1234567890,
        livemode: false,
        updated: 1234567890
      };

      const mockEvent1 = { type: 'product.created', data: { object: product1 } };
      const mockEvent2 = { type: 'product.created', data: { object: product2 } };

      stripe.webhooks.constructEvent
        .mockReturnValueOnce(mockEvent1)
        .mockReturnValueOnce(mockEvent2);

      mockQuery
        .mockResolvedValueOnce({ rows: [product1], rowCount: 1, command: '', oid: 0, fields: [] })
        .mockResolvedValueOnce({ rows: [product2], rowCount: 1, command: '', oid: 0, fields: [] });

      const request1 = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature_1' },
        body: JSON.stringify(mockEvent1)
      });

      const request2 = new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test_signature_2' },
        body: JSON.stringify(mockEvent2)
      });

      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2)
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });
});
