#!/usr/bin/env node

/**
 * Database Seed Script
 * Seeds the database with sample data for development/testing
 */

const { Client } = require('pg');

async function seedDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/nextjs_subscription',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Seeding database with sample data...');

    // Add sample products
    await client.query(`
      INSERT INTO products (id, active, name, description, metadata)
      VALUES
        ('prod_sample_1', true, 'Basic Plan', 'Basic subscription plan', '{}'),
        ('prod_sample_2', true, 'Pro Plan', 'Professional subscription plan', '{}')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Add sample prices
    await client.query(`
      INSERT INTO prices (id, product_id, active, currency, unit_amount, interval)
      VALUES
        ('price_sample_1', 'prod_sample_1', true, 'usd', 999, 'month'),
        ('price_sample_2', 'prod_sample_2', true, 'usd', 1999, 'month')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
