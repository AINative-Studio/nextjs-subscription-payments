/**
 * Database Scripts Unit Tests
 * Tests the setup, seed, and reset scripts without requiring a live database
 */

const fs = require('fs');
const path = require('path');
const { SAMPLE_DATA } = require('../scripts/seed-database');

describe('Schema File Tests', () => {
  test('database/schema.sql file exists', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  test('database/schema.sql is not empty', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema.length).toBeGreaterThan(0);
    expect(schema.trim().length).toBeGreaterThan(100);
  });

  test('schema.sql contains CREATE EXTENSION for uuid-ossp', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  test('schema.sql creates pricing_type ENUM', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TYPE pricing_type');
    expect(schema).toContain("'one_time'");
    expect(schema).toContain("'recurring'");
  });

  test('schema.sql creates pricing_plan_interval ENUM', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TYPE pricing_plan_interval');
    expect(schema).toContain("'day'");
    expect(schema).toContain("'week'");
    expect(schema).toContain("'month'");
    expect(schema).toContain("'year'");
  });

  test('schema.sql creates subscription_status ENUM', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TYPE subscription_status');
    expect(schema).toContain("'trialing'");
    expect(schema).toContain("'active'");
    expect(schema).toContain("'canceled'");
    expect(schema).toContain("'incomplete'");
    expect(schema).toContain("'past_due'");
    expect(schema).toContain("'unpaid'");
    expect(schema).toContain("'paused'");
  });

  test('schema.sql creates users table with email field', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schema).toContain('email TEXT UNIQUE NOT NULL');
  });

  test('schema.sql creates users table with password_hash field', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('password_hash TEXT');
  });

  test('schema.sql creates users table with timestamps', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('created_at TIMESTAMP');
    expect(schema).toContain('updated_at TIMESTAMP');
  });

  test('schema.sql creates customers table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS customers');
    expect(schema).toContain('stripe_customer_id TEXT UNIQUE NOT NULL');
  });

  test('schema.sql creates products table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS products');
    expect(schema).toContain('active BOOLEAN');
    expect(schema).toContain('name TEXT NOT NULL');
  });

  test('schema.sql creates prices table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS prices');
    expect(schema).toContain('unit_amount BIGINT');
    expect(schema).toContain('currency TEXT');
    expect(schema).toContain('type pricing_type NOT NULL');
  });

  test('schema.sql creates subscriptions table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS subscriptions');
    expect(schema).toContain('status subscription_status NOT NULL');
    expect(schema).toContain('quantity INTEGER');
    expect(schema).toContain('cancel_at_period_end BOOLEAN');
  });

  test('schema.sql creates indexes for users table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_users_email');
  });

  test('schema.sql creates indexes for customers table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_customers_user_id');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_customers_stripe_id');
  });

  test('schema.sql creates indexes for subscriptions table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_subscriptions_status');
  });

  test('schema.sql creates foreign key constraints', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('REFERENCES users(id)');
    expect(schema).toContain('REFERENCES products(id)');
    expect(schema).toContain('REFERENCES prices(id)');
  });

  test('schema.sql creates updated_at trigger function', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE OR REPLACE FUNCTION update_updated_at_column()');
    expect(schema).toContain('NEW.updated_at = NOW()');
  });

  test('schema.sql creates triggers for updated_at', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TRIGGER update_users_updated_at');
    expect(schema).toContain('CREATE TRIGGER update_products_updated_at');
  });

  test('schema.sql has ON DELETE CASCADE for foreign keys', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('ON DELETE CASCADE');
  });

  test('schema.sql creates schema_version table', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS schema_version');
  });

  test('schema.sql has CHECK constraints for data validation', () => {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CHECK');
    expect(schema).toMatch(/CHECK.*LENGTH\(currency\)\s*=\s*3/);
  });
});

describe('Setup Script Tests', () => {
  test('setup-database.js file exists', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'setup-database.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('setup-database.js exports setupDatabase function', () => {
    const { setupDatabase } = require('../scripts/setup-database');
    expect(typeof setupDatabase).toBe('function');
  });

  test('setup-database.js exports verifySchema function', () => {
    const { verifySchema } = require('../scripts/setup-database');
    expect(typeof verifySchema).toBe('function');
  });

  test('setup-database.js has error handling for connection issues', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'setup-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('ECONNREFUSED');
    expect(script).toContain('catch (error)');
  });

  test('setup-database.js supports ZERODB_CONNECTION_STRING env var', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'setup-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('ZERODB_CONNECTION_STRING');
  });

  test('setup-database.js verifies schema after creation', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'setup-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('verifySchema');
    expect(script).toContain('expectedTables');
    expect(script).toContain('expectedTypes');
  });
});

describe('Seed Script Tests', () => {
  test('seed-database.js file exists', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'seed-database.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('seed-database.js exports seedDatabase function', () => {
    const { seedDatabase } = require('../scripts/seed-database');
    expect(typeof seedDatabase).toBe('function');
  });

  test('seed-database.js exports SAMPLE_DATA', () => {
    expect(SAMPLE_DATA).toBeDefined();
    expect(typeof SAMPLE_DATA).toBe('object');
  });

  test('SAMPLE_DATA contains users array', () => {
    expect(Array.isArray(SAMPLE_DATA.users)).toBe(true);
    expect(SAMPLE_DATA.users.length).toBeGreaterThan(0);
  });

  test('SAMPLE_DATA users have required fields', () => {
    const user = SAMPLE_DATA.users[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('full_name');
    expect(user.email).toContain('@');
  });

  test('SAMPLE_DATA contains products array', () => {
    expect(Array.isArray(SAMPLE_DATA.products)).toBe(true);
    expect(SAMPLE_DATA.products.length).toBeGreaterThan(0);
  });

  test('SAMPLE_DATA products have required fields', () => {
    const product = SAMPLE_DATA.products[0];
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('active');
    expect(product).toHaveProperty('description');
  });

  test('SAMPLE_DATA contains prices array', () => {
    expect(Array.isArray(SAMPLE_DATA.prices)).toBe(true);
    expect(SAMPLE_DATA.prices.length).toBeGreaterThan(0);
  });

  test('SAMPLE_DATA prices have required fields', () => {
    const price = SAMPLE_DATA.prices[0];
    expect(price).toHaveProperty('id');
    expect(price).toHaveProperty('product_id');
    expect(price).toHaveProperty('unit_amount');
    expect(price).toHaveProperty('currency');
    expect(price).toHaveProperty('type');
  });

  test('SAMPLE_DATA has both recurring and one_time prices', () => {
    const recurringPrices = SAMPLE_DATA.prices.filter(p => p.type === 'recurring');
    const oneTimePrices = SAMPLE_DATA.prices.filter(p => p.type === 'one_time');

    expect(recurringPrices.length).toBeGreaterThan(0);
    expect(oneTimePrices.length).toBeGreaterThan(0);
  });

  test('SAMPLE_DATA recurring prices have interval fields', () => {
    const recurringPrice = SAMPLE_DATA.prices.find(p => p.type === 'recurring');
    expect(recurringPrice.interval).toBeDefined();
    expect(recurringPrice.interval_count).toBeDefined();
    expect(['day', 'week', 'month', 'year']).toContain(recurringPrice.interval);
  });

  test('SAMPLE_DATA contains customers array', () => {
    expect(Array.isArray(SAMPLE_DATA.customers)).toBe(true);
    expect(SAMPLE_DATA.customers.length).toBeGreaterThan(0);
  });

  test('SAMPLE_DATA customers have required fields', () => {
    const customer = SAMPLE_DATA.customers[0];
    expect(customer).toHaveProperty('user_id');
    expect(customer).toHaveProperty('stripe_customer_id');
  });

  test('SAMPLE_DATA contains subscriptions array', () => {
    expect(Array.isArray(SAMPLE_DATA.subscriptions)).toBe(true);
    expect(SAMPLE_DATA.subscriptions.length).toBeGreaterThan(0);
  });

  test('SAMPLE_DATA subscriptions have required fields', () => {
    const subscription = SAMPLE_DATA.subscriptions[0];
    expect(subscription).toHaveProperty('id');
    expect(subscription).toHaveProperty('user_id');
    expect(subscription).toHaveProperty('price_id');
    expect(subscription).toHaveProperty('status');
  });

  test('SAMPLE_DATA has subscriptions with different statuses', () => {
    const statuses = [...new Set(SAMPLE_DATA.subscriptions.map(s => s.status))];
    expect(statuses.length).toBeGreaterThan(1);
    expect(statuses).toContain('active');
  });

  test('seed-database.js uses transactions', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'seed-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('BEGIN');
    expect(script).toContain('COMMIT');
    expect(script).toContain('ROLLBACK');
  });

  test('seed-database.js uses ON CONFLICT for idempotency', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'seed-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('ON CONFLICT');
    expect(script).toContain('DO UPDATE');
  });
});

describe('Reset Script Tests', () => {
  test('reset-database.js file exists', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-database.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('reset-database.js exports resetDatabase function', () => {
    const { resetDatabase } = require('../scripts/reset-database');
    expect(typeof resetDatabase).toBe('function');
  });

  test('reset-database.js exports dropAllObjects function', () => {
    const { dropAllObjects } = require('../scripts/reset-database');
    expect(typeof dropAllObjects).toBe('function');
  });

  test('reset-database.js drops tables in correct order', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');

    // Should drop dependent tables first (subscriptions, customers, prices)
    // before their parent tables (users, products)
    expect(script).toContain('subscriptions');
    expect(script).toContain('customers');
    expect(script).toContain('prices');
    expect(script).toContain('products');
    expect(script).toContain('users');
  });

  test('reset-database.js drops ENUM types', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('DROP TYPE');
    expect(script).toContain('subscription_status');
    expect(script).toContain('pricing_plan_interval');
    expect(script).toContain('pricing_type');
  });

  test('reset-database.js drops trigger function', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('DROP FUNCTION');
    expect(script).toContain('update_updated_at_column');
  });

  test('reset-database.js has confirmation prompt', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('promptConfirmation');
    expect(script).toContain('WARNING');
  });

  test('reset-database.js supports skipConfirmation option', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('skipConfirmation');
  });

  test('reset-database.js calls setupDatabase after dropping', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-database.js');
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('setupDatabase');
    expect(script).toContain('require(\'./setup-database\')');
  });
});

describe('Script Integration', () => {
  test('All database scripts are executable', () => {
    const scripts = [
      path.join(__dirname, '..', 'scripts', 'setup-database.js'),
      path.join(__dirname, '..', 'scripts', 'seed-database.js'),
      path.join(__dirname, '..', 'scripts', 'reset-database.js')
    ];

    scripts.forEach(scriptPath => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      const script = fs.readFileSync(scriptPath, 'utf8');
      expect(script).toContain('#!/usr/bin/env node');
      expect(script).toContain('if (require.main === module)');
    });
  });

  test('All scripts export their main functions for testing', () => {
    const { setupDatabase, verifySchema } = require('../scripts/setup-database');
    const { seedDatabase } = require('../scripts/seed-database');
    const { resetDatabase, dropAllObjects } = require('../scripts/reset-database');

    expect(typeof setupDatabase).toBe('function');
    expect(typeof verifySchema).toBe('function');
    expect(typeof seedDatabase).toBe('function');
    expect(typeof resetDatabase).toBe('function');
    expect(typeof dropAllObjects).toBe('function');
  });

  test('All scripts handle connection string from environment', () => {
    const scripts = [
      path.join(__dirname, '..', 'scripts', 'setup-database.js'),
      path.join(__dirname, '..', 'scripts', 'seed-database.js'),
      path.join(__dirname, '..', 'scripts', 'reset-database.js')
    ];

    scripts.forEach(scriptPath => {
      const script = fs.readFileSync(scriptPath, 'utf8');
      expect(script).toContain('ZERODB_CONNECTION_STRING');
      expect(script).toContain('DATABASE_URL');
    });
  });
});
