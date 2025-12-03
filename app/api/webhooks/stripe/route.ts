import Stripe from 'stripe';
import { stripe } from '@/utils/stripe/config';
import { query } from '@/lib/zerodb';

/**
 * Helper function to convert Unix timestamp to ISO date string
 */
function toDateTime(secs: number): Date {
  const t = new Date(0); // Unix epoch start
  t.setSeconds(secs);
  return t;
}

/**
 * Upsert a product record from Stripe to ZeroDB
 */
async function upsertProductRecord(product: Stripe.Product) {
  const result = await query(
    `INSERT INTO products (id, active, name, description, image, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       active = EXCLUDED.active,
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       image = EXCLUDED.image,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING *`,
    [
      product.id,
      product.active,
      product.name,
      product.description || null,
      product.images?.[0] || null,
      JSON.stringify(product.metadata)
    ]
  );
  console.log(`Product inserted/updated: ${product.id}`);
  return result.rows[0];
}

/**
 * Upsert a price record from Stripe to ZeroDB
 */
async function upsertPriceRecord(
  price: Stripe.Price,
  retryCount = 0,
  maxRetries = 3
) {
  try {
    const result = await query(
      `INSERT INTO prices (
        id, product_id, active, currency, description,
        type, unit_amount, interval, interval_count,
        trial_period_days, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::pricing_type, $7, $8::pricing_plan_interval, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        active = EXCLUDED.active,
        currency = EXCLUDED.currency,
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        unit_amount = EXCLUDED.unit_amount,
        interval = EXCLUDED.interval,
        interval_count = EXCLUDED.interval_count,
        trial_period_days = EXCLUDED.trial_period_days,
        metadata = EXCLUDED.metadata
      RETURNING *`,
      [
        price.id,
        typeof price.product === 'string' ? price.product : price.product.id,
        price.active,
        price.currency,
        price.nickname || null,
        price.type,
        price.unit_amount || null,
        price.recurring?.interval || null,
        price.recurring?.interval_count || null,
        price.recurring?.trial_period_days || null,
        JSON.stringify(price.metadata)
      ]
    );
    console.log(`Price inserted/updated: ${price.id}`);
    return result.rows[0];
  } catch (error: any) {
    // Handle foreign key constraint errors with retry logic
    if (error.message?.includes('foreign key constraint') || error.code === '23503') {
      if (retryCount < maxRetries) {
        console.log(`Retry attempt ${retryCount + 1} for price ID: ${price.id}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return await upsertPriceRecord(price, retryCount + 1, maxRetries);
      } else {
        throw new Error(
          `Price insert/update failed after ${maxRetries} retries: ${error.message}`
        );
      }
    }
    throw new Error(`Price insert/update failed: ${error.message}`);
  }
}

/**
 * Delete a product record by marking it as inactive
 */
async function deleteProductRecord(product: Stripe.Product) {
  await query(
    `UPDATE products SET active = false, updated_at = NOW() WHERE id = $1`,
    [product.id]
  );
  console.log(`Product deleted: ${product.id}`);
}

/**
 * Delete a price record by marking it as inactive
 */
async function deletePriceRecord(price: Stripe.Price) {
  await query(
    `UPDATE prices SET active = false WHERE id = $1`,
    [price.id]
  );
  console.log(`Price deleted: ${price.id}`);
}

/**
 * Create or retrieve a customer from Stripe and ZeroDB
 */
async function createOrRetrieveCustomer({
  email,
  uuid
}: {
  email: string;
  uuid: string;
}) {
  // Check if customer exists in ZeroDB
  const existing = await query(
    'SELECT stripe_customer_id FROM customers WHERE user_id = $1',
    [uuid]
  );

  if (existing.rows.length > 0 && existing.rows[0].stripe_customer_id) {
    const stripeCustomerId = existing.rows[0].stripe_customer_id;

    // Verify customer exists in Stripe
    try {
      await stripe.customers.retrieve(stripeCustomerId);
      return stripeCustomerId;
    } catch (error) {
      console.warn(`Stripe customer ${stripeCustomerId} not found, creating new one`);
    }
  }

  // Try to find existing Stripe customer by email
  let stripeCustomerId: string | undefined;
  const stripeCustomers = await stripe.customers.list({ email });

  if (stripeCustomers.data.length > 0) {
    stripeCustomerId = stripeCustomers.data[0].id;
  } else {
    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: { user_id: uuid }
    });
    stripeCustomerId = customer.id;
  }

  // Upsert customer record in ZeroDB
  await query(
    `INSERT INTO customers (user_id, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = NOW()`,
    [uuid, stripeCustomerId]
  );

  console.log(`Customer record created/updated for user ${uuid}`);
  return stripeCustomerId;
}

/**
 * Copy billing details from payment method to customer
 */
async function copyBillingDetailsToCustomer(
  uuid: string,
  payment_method: Stripe.PaymentMethod
) {
  const customer = payment_method.customer as string;
  const { name, phone, address } = payment_method.billing_details;

  if (!name || !phone || !address) return;

  // Update Stripe customer
  await stripe.customers.update(customer, { name, phone, address });

  // Update user billing information in ZeroDB
  await query(
    `UPDATE users
     SET billing_address = $1,
         payment_method = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [
      JSON.stringify(address),
      JSON.stringify(payment_method[payment_method.type as keyof Stripe.PaymentMethod]),
      uuid
    ]
  );

  console.log(`Billing details updated for user ${uuid}`);
}

/**
 * Manage subscription status changes from Stripe webhooks
 */
async function manageSubscriptionStatusChange(
  subscriptionId: string,
  customerId: string,
  createAction = false
) {
  // Get user_id from customer mapping
  const customerResult = await query(
    'SELECT user_id FROM customers WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (customerResult.rows.length === 0) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  const userId = customerResult.rows[0].user_id;

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method']
  });

  // Prepare subscription data
  const subscriptionData = {
    id: subscription.id,
    user_id: userId,
    metadata: subscription.metadata,
    status: subscription.status,
    price_id: subscription.items.data[0].price.id,
    quantity: subscription.items.data[0].quantity || 1,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at
      ? toDateTime(subscription.cancel_at).toISOString()
      : null,
    canceled_at: subscription.canceled_at
      ? toDateTime(subscription.canceled_at).toISOString()
      : null,
    current_period_start: toDateTime(subscription.current_period_start).toISOString(),
    current_period_end: toDateTime(subscription.current_period_end).toISOString(),
    created: toDateTime(subscription.created).toISOString(),
    ended_at: subscription.ended_at
      ? toDateTime(subscription.ended_at).toISOString()
      : null,
    trial_start: subscription.trial_start
      ? toDateTime(subscription.trial_start).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? toDateTime(subscription.trial_end).toISOString()
      : null
  };

  // Upsert subscription
  await query(
    `INSERT INTO subscriptions (
      id, user_id, status, price_id, quantity,
      cancel_at_period_end, cancel_at, canceled_at,
      current_period_start, current_period_end,
      created, ended_at, trial_start, trial_end, metadata
    )
    VALUES ($1, $2, $3::subscription_status, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status::subscription_status,
      price_id = EXCLUDED.price_id,
      quantity = EXCLUDED.quantity,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      cancel_at = EXCLUDED.cancel_at,
      canceled_at = EXCLUDED.canceled_at,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      ended_at = EXCLUDED.ended_at,
      trial_start = EXCLUDED.trial_start,
      trial_end = EXCLUDED.trial_end,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()`,
    [
      subscriptionData.id,
      subscriptionData.user_id,
      subscriptionData.status,
      subscriptionData.price_id,
      subscriptionData.quantity,
      subscriptionData.cancel_at_period_end,
      subscriptionData.cancel_at,
      subscriptionData.canceled_at,
      subscriptionData.current_period_start,
      subscriptionData.current_period_end,
      subscriptionData.created,
      subscriptionData.ended_at,
      subscriptionData.trial_start,
      subscriptionData.trial_end,
      JSON.stringify(subscriptionData.metadata)
    ]
  );

  console.log(`Inserted/updated subscription [${subscription.id}] for user [${userId}]`);

  // For new subscriptions, copy billing details
  if (createAction && subscription.default_payment_method && userId) {
    await copyBillingDetailsToCustomer(
      userId,
      subscription.default_payment_method as Stripe.PaymentMethod
    );
  }
}

/**
 * Webhook handler for Stripe events
 */
const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'product.deleted',
  'price.created',
  'price.updated',
  'price.deleted',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted'
]);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      return new Response('Webhook secret not found.', { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    console.log(`🔔 Webhook received: ${event.type}`);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case 'product.created':
        case 'product.updated':
          await upsertProductRecord(event.data.object as Stripe.Product);
          break;
        case 'price.created':
        case 'price.updated':
          await upsertPriceRecord(event.data.object as Stripe.Price);
          break;
        case 'price.deleted':
          await deletePriceRecord(event.data.object as Stripe.Price);
          break;
        case 'product.deleted':
          await deleteProductRecord(event.data.object as Stripe.Product);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          await manageSubscriptionStatusChange(
            subscription.id,
            subscription.customer as string,
            event.type === 'customer.subscription.created'
          );
          break;
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === 'subscription') {
            const subscriptionId = checkoutSession.subscription;
            await manageSubscriptionStatusChange(
              subscriptionId as string,
              checkoutSession.customer as string,
              true
            );
          }
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }
    } catch (error) {
      console.log(error);
      return new Response(
        'Webhook handler failed. View your Next.js function logs.',
        {
          status: 400
        }
      );
    }
  } else {
    return new Response(`Unsupported event type: ${event.type}`, {
      status: 400
    });
  }

  return new Response(JSON.stringify({ received: true }));
}
