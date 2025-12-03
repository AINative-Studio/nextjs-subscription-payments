/**
 * Stripe Mock Factories
 * Mock data for Stripe webhook events and API responses
 */

import Stripe from 'stripe';

/**
 * Mock Stripe customer
 */
export function createMockStripeCustomer(overrides: Partial<Stripe.Customer> = {}): Stripe.Customer {
  return {
    id: 'cus_test123',
    object: 'customer',
    address: null,
    balance: 0,
    created: Math.floor(Date.now() / 1000),
    currency: null,
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: 'test@example.com',
    invoice_prefix: 'TEST',
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    livemode: false,
    metadata: {},
    name: 'Test Customer',
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: 'none',
    test_clock: null,
    ...overrides,
  } as Stripe.Customer;
}

/**
 * Mock Stripe product
 */
export function createMockStripeProduct(overrides: Partial<Stripe.Product> = {}): Stripe.Product {
  return {
    id: 'prod_test123',
    object: 'product',
    active: true,
    created: Math.floor(Date.now() / 1000),
    default_price: null,
    description: 'Test Product',
    images: [],
    livemode: false,
    metadata: {},
    name: 'Test Product',
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    unit_label: null,
    updated: Math.floor(Date.now() / 1000),
    url: null,
    ...overrides,
  } as Stripe.Product;
}

/**
 * Mock Stripe price
 */
export function createMockStripePrice(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: 'price_test123',
    object: 'price',
    active: true,
    billing_scheme: 'per_unit',
    created: Math.floor(Date.now() / 1000),
    currency: 'usd',
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {},
    nickname: null,
    product: 'prod_test123',
    recurring: {
      aggregate_usage: null,
      interval: 'month',
      interval_count: 1,
      trial_period_days: null,
      usage_type: 'licensed',
    },
    tax_behavior: 'unspecified',
    tiers_mode: null,
    transform_quantity: null,
    type: 'recurring',
    unit_amount: 1000,
    unit_amount_decimal: '1000',
    ...overrides,
  } as Stripe.Price;
}

/**
 * Mock Stripe subscription
 */
export function createMockStripeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  const periodEnd = now + 30 * 24 * 60 * 60; // 30 days

  return {
    id: 'sub_test123',
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: {
      enabled: false,
    },
    billing_cycle_anchor: now,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: null,
    collection_method: 'charge_automatically',
    created: now,
    currency: 'usd',
    current_period_end: periodEnd,
    current_period_start: now,
    customer: 'cus_test123',
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: null,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test123',
          object: 'subscription_item',
          billing_thresholds: null,
          created: now,
          metadata: {},
          price: createMockStripePrice(),
          quantity: 1,
          subscription: 'sub_test123',
          tax_rates: [],
        },
      ],
      has_more: false,
      url: '/v1/subscription_items?subscription=sub_test123',
    },
    latest_invoice: null,
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'off',
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: now,
    status: 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: null,
    trial_start: null,
    ...overrides,
  } as Stripe.Subscription;
}

/**
 * Mock Stripe checkout session
 */
export function createMockCheckoutSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    after_expiration: null,
    allow_promotion_codes: null,
    amount_subtotal: 1000,
    amount_total: 1000,
    automatic_tax: {
      enabled: false,
      status: null,
    },
    billing_address_collection: null,
    cancel_url: 'http://localhost:3000/cancel',
    client_reference_id: null,
    consent: null,
    consent_collection: null,
    created: Math.floor(Date.now() / 1000),
    currency: 'usd',
    currency_conversion: null,
    custom_fields: [],
    custom_text: {
      shipping_address: null,
      submit: null,
      terms_of_service_acceptance: null,
    },
    customer: 'cus_test123',
    customer_creation: null,
    customer_details: null,
    customer_email: 'test@example.com',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    invoice: null,
    invoice_creation: null,
    livemode: false,
    locale: null,
    metadata: {},
    mode: 'subscription',
    payment_intent: null,
    payment_link: null,
    payment_method_collection: 'always',
    payment_method_configuration_details: null,
    payment_method_options: null,
    payment_method_types: ['card'],
    payment_status: 'unpaid',
    phone_number_collection: {
      enabled: false,
    },
    recovered_from: null,
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: null,
    shipping_details: null,
    shipping_options: [],
    status: 'open',
    submit_type: null,
    subscription: null,
    success_url: 'http://localhost:3000/success',
    total_details: {
      amount_discount: 0,
      amount_shipping: 0,
      amount_tax: 0,
    },
    ui_mode: 'hosted',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    ...overrides,
  } as Stripe.Checkout.Session;
}

/**
 * Mock Stripe webhook event
 */
export function createMockWebhookEvent(
  type: string,
  data: any,
  overrides: Partial<Stripe.Event> = {}
): Stripe.Event {
  return {
    id: 'evt_test123',
    object: 'event',
    account: null,
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data,
      previous_attributes: undefined,
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    type,
    ...overrides,
  } as Stripe.Event;
}

/**
 * Mock customer.subscription.created event
 */
export function createSubscriptionCreatedEvent(
  subscription?: Partial<Stripe.Subscription>
): Stripe.Event {
  return createMockWebhookEvent(
    'customer.subscription.created',
    createMockStripeSubscription(subscription)
  );
}

/**
 * Mock customer.subscription.updated event
 */
export function createSubscriptionUpdatedEvent(
  subscription?: Partial<Stripe.Subscription>
): Stripe.Event {
  return createMockWebhookEvent(
    'customer.subscription.updated',
    createMockStripeSubscription(subscription)
  );
}

/**
 * Mock customer.subscription.deleted event
 */
export function createSubscriptionDeletedEvent(
  subscription?: Partial<Stripe.Subscription>
): Stripe.Event {
  return createMockWebhookEvent(
    'customer.subscription.deleted',
    createMockStripeSubscription({ status: 'canceled', ...subscription })
  );
}

/**
 * Mock checkout.session.completed event
 */
export function createCheckoutSessionCompletedEvent(
  session?: Partial<Stripe.Checkout.Session>
): Stripe.Event {
  return createMockWebhookEvent(
    'checkout.session.completed',
    createMockCheckoutSession({ status: 'complete', ...session })
  );
}

/**
 * Mock product.created event
 */
export function createProductCreatedEvent(
  product?: Partial<Stripe.Product>
): Stripe.Event {
  return createMockWebhookEvent(
    'product.created',
    createMockStripeProduct(product)
  );
}

/**
 * Mock product.updated event
 */
export function createProductUpdatedEvent(
  product?: Partial<Stripe.Product>
): Stripe.Event {
  return createMockWebhookEvent(
    'product.updated',
    createMockStripeProduct(product)
  );
}

/**
 * Mock price.created event
 */
export function createPriceCreatedEvent(
  price?: Partial<Stripe.Price>
): Stripe.Event {
  return createMockWebhookEvent(
    'price.created',
    createMockStripePrice(price)
  );
}

/**
 * Mock price.updated event
 */
export function createPriceUpdatedEvent(
  price?: Partial<Stripe.Price>
): Stripe.Event {
  return createMockWebhookEvent(
    'price.updated',
    createMockStripePrice(price)
  );
}
