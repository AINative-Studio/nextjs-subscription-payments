#!/usr/bin/env node

/**
 * Database Seed Script
 * Seeds the database with sample data for development and testing
 *
 * Features:
 * - Creates sample users with various subscription states
 * - Creates realistic product catalog
 * - Creates pricing tiers (Basic, Pro, Enterprise)
 * - Creates sample subscriptions with different statuses
 * - Idempotent: Uses ON CONFLICT to avoid duplicates
 */

const { Client } = require('pg');

/**
 * Sample data definitions
 */
const SAMPLE_DATA = {
  users: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'free@example.com',
      full_name: 'Free User',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=free',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'basic@example.com',
      full_name: 'Basic Plan User',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=basic',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      email: 'pro@example.com',
      full_name: 'Pro Plan User',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pro',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      email: 'enterprise@example.com',
      full_name: 'Enterprise User',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=enterprise',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      email: 'trial@example.com',
      full_name: 'Trial User',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=trial',
    },
  ],

  products: [
    {
      id: 'prod_basic',
      active: true,
      name: 'Basic Plan',
      description: 'Perfect for individuals and small projects',
      image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400',
      metadata: { features: ['10 Projects', 'Basic Support', '1 GB Storage'] },
    },
    {
      id: 'prod_pro',
      active: true,
      name: 'Pro Plan',
      description: 'Ideal for professionals and growing teams',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400',
      metadata: { features: ['Unlimited Projects', 'Priority Support', '50 GB Storage', 'Advanced Analytics'] },
    },
    {
      id: 'prod_enterprise',
      active: true,
      name: 'Enterprise Plan',
      description: 'For large organizations with advanced needs',
      image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400',
      metadata: { features: ['Unlimited Everything', '24/7 Dedicated Support', 'Custom Integrations', 'SLA Guarantee'] },
    },
    {
      id: 'prod_addon_storage',
      active: true,
      name: 'Extra Storage',
      description: 'Add 100 GB of additional storage',
      image: 'https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=400',
      metadata: { addon: true },
    },
  ],

  prices: [
    // Basic Plan Prices
    {
      id: 'price_basic_monthly',
      product_id: 'prod_basic',
      active: true,
      description: 'Basic plan billed monthly',
      unit_amount: 999, // $9.99
      currency: 'usd',
      type: 'recurring',
      interval: 'month',
      interval_count: 1,
      trial_period_days: 14,
    },
    {
      id: 'price_basic_yearly',
      product_id: 'prod_basic',
      active: true,
      description: 'Basic plan billed annually (save 20%)',
      unit_amount: 9590, // $95.90
      currency: 'usd',
      type: 'recurring',
      interval: 'year',
      interval_count: 1,
      trial_period_days: 14,
    },

    // Pro Plan Prices
    {
      id: 'price_pro_monthly',
      product_id: 'prod_pro',
      active: true,
      description: 'Pro plan billed monthly',
      unit_amount: 2999, // $29.99
      currency: 'usd',
      type: 'recurring',
      interval: 'month',
      interval_count: 1,
      trial_period_days: 14,
    },
    {
      id: 'price_pro_yearly',
      product_id: 'prod_pro',
      active: true,
      description: 'Pro plan billed annually (save 20%)',
      unit_amount: 28790, // $287.90
      currency: 'usd',
      type: 'recurring',
      interval: 'year',
      interval_count: 1,
      trial_period_days: 14,
    },

    // Enterprise Plan Prices
    {
      id: 'price_enterprise_monthly',
      product_id: 'prod_enterprise',
      active: true,
      description: 'Enterprise plan billed monthly',
      unit_amount: 9999, // $99.99
      currency: 'usd',
      type: 'recurring',
      interval: 'month',
      interval_count: 1,
      trial_period_days: null,
    },
    {
      id: 'price_enterprise_yearly',
      product_id: 'prod_enterprise',
      active: true,
      description: 'Enterprise plan billed annually (save 20%)',
      unit_amount: 95990, // $959.90
      currency: 'usd',
      type: 'recurring',
      interval: 'year',
      interval_count: 1,
      trial_period_days: null,
    },

    // Add-on Prices
    {
      id: 'price_storage_monthly',
      product_id: 'prod_addon_storage',
      active: true,
      description: 'Extra storage billed monthly',
      unit_amount: 499, // $4.99
      currency: 'usd',
      type: 'recurring',
      interval: 'month',
      interval_count: 1,
      trial_period_days: null,
    },
    {
      id: 'price_storage_onetime',
      product_id: 'prod_addon_storage',
      active: true,
      description: 'One-time storage purchase',
      unit_amount: 4999, // $49.99
      currency: 'usd',
      type: 'one_time',
      interval: null,
      interval_count: null,
      trial_period_days: null,
    },
  ],

  customers: [
    {
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      stripe_customer_id: 'cus_sample_basic',
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      stripe_customer_id: 'cus_sample_pro',
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      stripe_customer_id: 'cus_sample_enterprise',
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440005',
      stripe_customer_id: 'cus_sample_trial',
    },
  ],

  subscriptions: [
    {
      id: 'sub_basic_active',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      price_id: 'price_basic_monthly',
      status: 'active',
      quantity: 1,
      cancel_at_period_end: false,
      current_period_start: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
    },
    {
      id: 'sub_pro_active',
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      price_id: 'price_pro_yearly',
      status: 'active',
      quantity: 1,
      cancel_at_period_end: false,
      current_period_start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 180 days ago
      current_period_end: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000), // 185 days from now
    },
    {
      id: 'sub_enterprise_active',
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      price_id: 'price_enterprise_monthly',
      status: 'active',
      quantity: 5, // 5 seats
      cancel_at_period_end: false,
      current_period_start: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      current_period_end: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'sub_trial_trialing',
      user_id: '550e8400-e29b-41d4-a716-446655440005',
      price_id: 'price_pro_monthly',
      status: 'trialing',
      quantity: 1,
      cancel_at_period_end: false,
      trial_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      current_period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  ],
};

/**
 * Seed the database with sample data
 */
async function seedDatabase() {
  const connectionString = process.env.ZERODB_CONNECTION_STRING ||
                          process.env.DATABASE_URL ||
                          'postgresql://localhost:5432/nextjs_subscription';

  console.log('🌱 Starting database seeding...');
  console.log(`📍 Connection: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

  const client = new Client({ connectionString });

  try {
    // Connect to database
    console.log('\n📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Begin transaction
    await client.query('BEGIN');
    console.log('\n🔄 Starting transaction...');

    // Seed users
    console.log('\n👥 Seeding users...');
    for (const user of SAMPLE_DATA.users) {
      await client.query(
        `INSERT INTO users (id, email, full_name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             full_name = EXCLUDED.full_name,
             avatar_url = EXCLUDED.avatar_url`,
        [user.id, user.email, user.full_name, user.avatar_url]
      );
    }
    console.log(`   ✅ Created/updated ${SAMPLE_DATA.users.length} users`);

    // Seed products
    console.log('\n📦 Seeding products...');
    for (const product of SAMPLE_DATA.products) {
      await client.query(
        `INSERT INTO products (id, active, name, description, image, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
         SET active = EXCLUDED.active,
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             image = EXCLUDED.image,
             metadata = EXCLUDED.metadata`,
        [
          product.id,
          product.active,
          product.name,
          product.description,
          product.image,
          JSON.stringify(product.metadata),
        ]
      );
    }
    console.log(`   ✅ Created/updated ${SAMPLE_DATA.products.length} products`);

    // Seed prices
    console.log('\n💰 Seeding prices...');
    for (const price of SAMPLE_DATA.prices) {
      await client.query(
        `INSERT INTO prices (id, product_id, active, description, unit_amount, currency, type, interval, interval_count, trial_period_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE
         SET product_id = EXCLUDED.product_id,
             active = EXCLUDED.active,
             description = EXCLUDED.description,
             unit_amount = EXCLUDED.unit_amount,
             currency = EXCLUDED.currency,
             type = EXCLUDED.type,
             interval = EXCLUDED.interval,
             interval_count = EXCLUDED.interval_count,
             trial_period_days = EXCLUDED.trial_period_days`,
        [
          price.id,
          price.product_id,
          price.active,
          price.description,
          price.unit_amount,
          price.currency,
          price.type,
          price.interval,
          price.interval_count,
          price.trial_period_days,
        ]
      );
    }
    console.log(`   ✅ Created/updated ${SAMPLE_DATA.prices.length} prices`);

    // Seed customers
    console.log('\n🛒 Seeding customers...');
    for (const customer of SAMPLE_DATA.customers) {
      await client.query(
        `INSERT INTO customers (user_id, stripe_customer_id)
         VALUES ($1, $2)
         ON CONFLICT (stripe_customer_id) DO UPDATE
         SET user_id = EXCLUDED.user_id`,
        [customer.user_id, customer.stripe_customer_id]
      );
    }
    console.log(`   ✅ Created/updated ${SAMPLE_DATA.customers.length} customers`);

    // Seed subscriptions
    console.log('\n🔄 Seeding subscriptions...');
    for (const subscription of SAMPLE_DATA.subscriptions) {
      await client.query(
        `INSERT INTO subscriptions (id, user_id, price_id, status, quantity, cancel_at_period_end, current_period_start, current_period_end, trial_start, trial_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             price_id = EXCLUDED.price_id,
             status = EXCLUDED.status,
             quantity = EXCLUDED.quantity,
             cancel_at_period_end = EXCLUDED.cancel_at_period_end,
             current_period_start = EXCLUDED.current_period_start,
             current_period_end = EXCLUDED.current_period_end,
             trial_start = EXCLUDED.trial_start,
             trial_end = EXCLUDED.trial_end`,
        [
          subscription.id,
          subscription.user_id,
          subscription.price_id,
          subscription.status,
          subscription.quantity,
          subscription.cancel_at_period_end,
          subscription.current_period_start,
          subscription.current_period_end,
          subscription.trial_start || null,
          subscription.trial_end || null,
        ]
      );
    }
    console.log(`   ✅ Created/updated ${SAMPLE_DATA.subscriptions.length} subscriptions`);

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed');

    // Display summary
    console.log('\n📊 Seeding Summary:');
    console.log(`   • Users: ${SAMPLE_DATA.users.length}`);
    console.log(`   • Products: ${SAMPLE_DATA.products.length}`);
    console.log(`   • Prices: ${SAMPLE_DATA.prices.length}`);
    console.log(`   • Customers: ${SAMPLE_DATA.customers.length}`);
    console.log(`   • Subscriptions: ${SAMPLE_DATA.subscriptions.length}`);

    console.log('\n✅ Database seeded successfully! 🌱');

    // Display test accounts
    console.log('\n📧 Test Accounts:');
    SAMPLE_DATA.users.forEach(user => {
      console.log(`   • ${user.email} (${user.full_name})`);
    });

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding database (transaction rolled back):');
    console.error(`   ${error.message}`);

    if (process.env.VERBOSE) {
      console.error('\nFull error:', error);
    }

    throw error;

  } finally {
    // Always close connection
    try {
      await client.end();
      console.log('\n🔌 Database connection closed');
    } catch (endError) {
      console.error('Warning: Error closing database connection:', endError.message);
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  try {
    await seedDatabase();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { seedDatabase, SAMPLE_DATA };
