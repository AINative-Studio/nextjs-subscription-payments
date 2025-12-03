/**
 * Comprehensive Database Integration Tests
 * Tests schema.sql, setup-database.js, seed-database.js, and reset-database.js
 *
 * Test Coverage:
 * - Schema execution
 * - Table creation and structure
 * - ENUM type creation
 * - Index creation
 * - Foreign key constraints
 * - Trigger functionality
 * - Setup script idempotency
 * - Seed script data insertion
 * - Reset script cleanup
 * - Full lifecycle integration test
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { setupDatabase, verifySchema } = require('../scripts/setup-database');
const { seedDatabase, SAMPLE_DATA } = require('../scripts/seed-database');
const { resetDatabase, dropAllObjects } = require('../scripts/reset-database');

// Test database connection
const TEST_DB_URL = process.env.TEST_DATABASE_URL ||
                    process.env.ZERODB_CONNECTION_STRING ||
                    process.env.DATABASE_URL ||
                    'postgresql://localhost:5432/nextjs_subscription_test';

describe('Database Schema Tests', () => {
  let client;
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      client = new Client({ connectionString: TEST_DB_URL });
      await client.connect();
      dbAvailable = true;
    } catch (error) {
      console.log('Database not available, skipping database-dependent tests');
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (client && dbAvailable) {
      await client.end();
    }
  });

  describe('Schema File', () => {
    test('schema.sql file exists', () => {
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      expect(fs.existsSync(schemaPath)).toBe(true);
    });

    test('schema.sql is not empty', () => {
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      expect(schema.length).toBeGreaterThan(0);
      expect(schema.trim().length).toBeGreaterThan(0);
    });

    test('schema.sql contains required SQL keywords', () => {
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      expect(schema).toContain('CREATE TABLE');
      expect(schema).toContain('CREATE TYPE');
      expect(schema).toContain('CREATE EXTENSION');
      expect(schema).toContain('CREATE OR REPLACE FUNCTION');
      expect(schema).toContain('CREATE TRIGGER');
    });
  });

  describe('ENUM Types', () => {
    test('pricing_type enum is created', async () => {
      if (!dbAvailable) return;
      const { rows } = await client.query(`
        SELECT typname, enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE typname = 'pricing_type'
        ORDER BY enumlabel
      `);

      expect(rows.length).toBeGreaterThan(0);
      const labels = rows.map(r => r.enumlabel);
      expect(labels).toContain('one_time');
      expect(labels).toContain('recurring');
    });

    test('pricing_plan_interval enum is created', async () => {
      const { rows } = await client.query(`
        SELECT typname, enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE typname = 'pricing_plan_interval'
        ORDER BY enumlabel
      `);

      expect(rows.length).toBeGreaterThan(0);
      const labels = rows.map(r => r.enumlabel);
      expect(labels).toContain('day');
      expect(labels).toContain('week');
      expect(labels).toContain('month');
      expect(labels).toContain('year');
    });

    test('subscription_status enum is created', async () => {
      const { rows } = await client.query(`
        SELECT typname, enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE typname = 'subscription_status'
        ORDER BY enumlabel
      `);

      expect(rows.length).toBeGreaterThan(0);
      const labels = rows.map(r => r.enumlabel);
      expect(labels).toContain('trialing');
      expect(labels).toContain('active');
      expect(labels).toContain('canceled');
      expect(labels).toContain('incomplete');
      expect(labels).toContain('past_due');
    });
  });

  describe('Table Creation', () => {
    test('users table is created with correct structure', async () => {
      const { rows } = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);

      expect(rows.length).toBeGreaterThan(0);

      const columnNames = rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('password_hash');
      expect(columnNames).toContain('full_name');
      expect(columnNames).toContain('avatar_url');
      expect(columnNames).toContain('billing_address');
      expect(columnNames).toContain('payment_method');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    test('users table has email UNIQUE constraint', async () => {
      const { rows } = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'users' AND constraint_type = 'UNIQUE'
      `);

      const constraintColumns = await client.query(`
        SELECT column_name
        FROM information_schema.constraint_column_usage
        WHERE constraint_name IN (
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'users' AND constraint_type = 'UNIQUE'
        )
      `);

      const columns = constraintColumns.rows.map(r => r.column_name);
      expect(columns).toContain('email');
    });

    test('customers table is created', async () => {
      const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'customers'
      `);

      const columnNames = rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('stripe_customer_id');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    test('products table is created', async () => {
      const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'products'
      `);

      const columnNames = rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('active');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('image');
      expect(columnNames).toContain('metadata');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    test('prices table is created', async () => {
      const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'prices'
      `);

      const columnNames = rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('product_id');
      expect(columnNames).toContain('active');
      expect(columnNames).toContain('unit_amount');
      expect(columnNames).toContain('currency');
      expect(columnNames).toContain('type');
      expect(columnNames).toContain('interval');
      expect(columnNames).toContain('interval_count');
      expect(columnNames).toContain('trial_period_days');
    });

    test('subscriptions table is created', async () => {
      const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'subscriptions'
      `);

      const columnNames = rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('price_id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('quantity');
      expect(columnNames).toContain('cancel_at_period_end');
      expect(columnNames).toContain('created');
      expect(columnNames).toContain('current_period_start');
      expect(columnNames).toContain('current_period_end');
    });

    test('schema_version table is created', async () => {
      const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'schema_version'
      `);

      const columnNames = rows.map(r => r.column_name);
      expect(columnNames).toContain('version');
      expect(columnNames).toContain('applied_at');
      expect(columnNames).toContain('description');
    });
  });

  describe('Foreign Key Constraints', () => {
    test('customers.user_id references users.id', async () => {
      const { rows } = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'customers'
          AND kcu.column_name = 'user_id'
      `);

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].foreign_table_name).toBe('users');
      expect(rows[0].foreign_column_name).toBe('id');
    });

    test('prices.product_id references products.id', async () => {
      const { rows } = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'prices'
          AND kcu.column_name = 'product_id'
      `);

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].foreign_table_name).toBe('products');
      expect(rows[0].foreign_column_name).toBe('id');
    });

    test('subscriptions.user_id references users.id', async () => {
      const { rows } = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'subscriptions'
          AND kcu.column_name = 'user_id'
      `);

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].foreign_table_name).toBe('users');
    });
  });

  describe('Indexes', () => {
    test('users table has indexes', async () => {
      const { rows } = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'users'
      `);

      expect(rows.length).toBeGreaterThan(0);
      const indexNames = rows.map(r => r.indexname);
      expect(indexNames.some(name => name.includes('email'))).toBe(true);
    });

    test('customers table has indexes', async () => {
      const { rows } = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'customers'
      `);

      expect(rows.length).toBeGreaterThan(0);
      const indexNames = rows.map(r => r.indexname);
      expect(indexNames.some(name => name.includes('user_id'))).toBe(true);
      expect(indexNames.some(name => name.includes('stripe'))).toBe(true);
    });

    test('prices table has indexes', async () => {
      const { rows } = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'prices'
      `);

      expect(rows.length).toBeGreaterThan(0);
      const indexNames = rows.map(r => r.indexname);
      expect(indexNames.some(name => name.includes('product_id'))).toBe(true);
    });

    test('subscriptions table has indexes', async () => {
      const { rows } = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'subscriptions'
      `);

      expect(rows.length).toBeGreaterThan(0);
      const indexNames = rows.map(r => r.indexname);
      expect(indexNames.some(name => name.includes('user_id'))).toBe(true);
      expect(indexNames.some(name => name.includes('status'))).toBe(true);
    });
  });

  describe('Triggers and Functions', () => {
    test('update_updated_at_column function exists', async () => {
      const { rows } = await client.query(`
        SELECT proname
        FROM pg_proc
        WHERE proname = 'update_updated_at_column'
      `);

      expect(rows.length).toBeGreaterThan(0);
    });

    test('users table has updated_at trigger', async () => {
      const { rows } = await client.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'users'
        AND trigger_name LIKE '%updated_at%'
      `);

      expect(rows.length).toBeGreaterThan(0);
    });

    test('updated_at trigger updates timestamp on users', async () => {
      // Insert a test user
      const insertResult = await client.query(`
        INSERT INTO users (email, full_name)
        VALUES ('trigger-test@example.com', 'Trigger Test')
        RETURNING id, created_at, updated_at
      `);

      const userId = insertResult.rows[0].id;
      const initialUpdatedAt = insertResult.rows[0].updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update the user
      await client.query(`
        UPDATE users
        SET full_name = 'Updated Name'
        WHERE id = $1
      `, [userId]);

      // Check updated_at changed
      const { rows } = await client.query(`
        SELECT updated_at
        FROM users
        WHERE id = $1
      `, [userId]);

      expect(new Date(rows[0].updated_at).getTime()).toBeGreaterThan(
        new Date(initialUpdatedAt).getTime()
      );

      // Cleanup
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  });
});

describe('Database Scripts Tests', () => {
  describe('setup-database.js', () => {
    test('setupDatabase function is exported', () => {
      expect(typeof setupDatabase).toBe('function');
    });

    test('verifySchema function is exported', () => {
      expect(typeof verifySchema).toBe('function');
    });

    test('setup is idempotent (can run multiple times)', async () => {
      // First run
      const result1 = await setupDatabase();
      expect(result1.success).toBe(true);

      // Second run should not fail
      const result2 = await setupDatabase();
      expect(result2.success).toBe(true);
    });
  });

  describe('seed-database.js', () => {
    test('seedDatabase function is exported', () => {
      expect(typeof seedDatabase).toBe('function');
    });

    test('SAMPLE_DATA is exported', () => {
      expect(SAMPLE_DATA).toBeDefined();
      expect(SAMPLE_DATA.users).toBeDefined();
      expect(SAMPLE_DATA.products).toBeDefined();
      expect(SAMPLE_DATA.prices).toBeDefined();
      expect(SAMPLE_DATA.customers).toBeDefined();
      expect(SAMPLE_DATA.subscriptions).toBeDefined();
    });

    test('SAMPLE_DATA has valid structure', () => {
      expect(Array.isArray(SAMPLE_DATA.users)).toBe(true);
      expect(SAMPLE_DATA.users.length).toBeGreaterThan(0);

      expect(Array.isArray(SAMPLE_DATA.products)).toBe(true);
      expect(SAMPLE_DATA.products.length).toBeGreaterThan(0);

      expect(Array.isArray(SAMPLE_DATA.prices)).toBe(true);
      expect(SAMPLE_DATA.prices.length).toBeGreaterThan(0);

      // Verify user structure
      const user = SAMPLE_DATA.users[0];
      expect(user.email).toBeDefined();
      expect(user.id).toBeDefined();

      // Verify product structure
      const product = SAMPLE_DATA.products[0];
      expect(product.id).toBeDefined();
      expect(product.name).toBeDefined();
      expect(product.active).toBeDefined();
    });

    test('seedDatabase creates sample users', async () => {
      const testClient = new Client({ connectionString: TEST_DB_URL });
      await testClient.connect();

      await seedDatabase();

      const { rows } = await testClient.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email LIKE '%@example.com'
      `);

      expect(parseInt(rows[0].count)).toBeGreaterThan(0);

      await testClient.end();
    });

    test('seedDatabase creates sample products', async () => {
      const testClient = new Client({ connectionString: TEST_DB_URL });
      await testClient.connect();

      await seedDatabase();

      const { rows } = await testClient.query(`
        SELECT COUNT(*) as count
        FROM products
      `);

      expect(parseInt(rows[0].count)).toBeGreaterThan(0);

      await testClient.end();
    });

    test('seedDatabase is idempotent', async () => {
      // Run seed twice
      await seedDatabase();
      await seedDatabase();

      const testClient = new Client({ connectionString: TEST_DB_URL });
      await testClient.connect();

      const { rows } = await testClient.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email LIKE '%@example.com'
      `);

      // Should not duplicate users
      expect(parseInt(rows[0].count)).toBe(SAMPLE_DATA.users.length);

      await testClient.end();
    });
  });

  describe('reset-database.js', () => {
    test('resetDatabase function is exported', () => {
      expect(typeof resetDatabase).toBe('function');
    });

    test('dropAllObjects function is exported', () => {
      expect(typeof dropAllObjects).toBe('function');
    });

    test('resetDatabase drops and recreates all tables', async () => {
      const testClient = new Client({ connectionString: TEST_DB_URL });
      await testClient.connect();

      // Add some test data
      await seedDatabase();

      // Count users before reset
      const beforeReset = await testClient.query('SELECT COUNT(*) as count FROM users');
      expect(parseInt(beforeReset.rows[0].count)).toBeGreaterThan(0);

      await testClient.end();

      // Reset database
      await resetDatabase({ skipConfirmation: true });

      // Verify tables were recreated but empty
      const afterClient = new Client({ connectionString: TEST_DB_URL });
      await afterClient.connect();

      const afterReset = await afterClient.query('SELECT COUNT(*) as count FROM users');
      expect(parseInt(afterReset.rows[0].count)).toBe(0);

      // Verify table structure is intact
      const { rows: tables } = await afterClient.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `);

      expect(tables.length).toBeGreaterThan(0);

      await afterClient.end();
    });
  });
});

describe('Integration Tests', () => {
  test('Full lifecycle: reset → setup → seed → query → reset', async () => {
    const testClient = new Client({ connectionString: TEST_DB_URL });
    await testClient.connect();

    // 1. Reset database
    await resetDatabase({ skipConfirmation: true });

    // 2. Verify empty
    let { rows } = await testClient.query('SELECT COUNT(*) as count FROM users');
    expect(parseInt(rows[0].count)).toBe(0);

    // 3. Seed database
    await seedDatabase();

    // 4. Query and verify data
    const usersResult = await testClient.query('SELECT * FROM users ORDER BY email');
    expect(usersResult.rows.length).toBeGreaterThan(0);

    const productsResult = await testClient.query('SELECT * FROM products WHERE active = true');
    expect(productsResult.rows.length).toBeGreaterThan(0);

    const pricesResult = await testClient.query('SELECT * FROM prices WHERE active = true');
    expect(pricesResult.rows.length).toBeGreaterThan(0);

    const subsResult = await testClient.query('SELECT * FROM subscriptions WHERE status = $1', ['active']);
    expect(subsResult.rows.length).toBeGreaterThan(0);

    // 5. Final reset
    await testClient.end();
    await resetDatabase({ skipConfirmation: true });

    const finalClient = new Client({ connectionString: TEST_DB_URL });
    await finalClient.connect();

    const finalCheck = await finalClient.query('SELECT COUNT(*) as count FROM users');
    expect(parseInt(finalCheck.rows[0].count)).toBe(0);

    await finalClient.end();
  });

  test('Verify CASCADE deletes work correctly', async () => {
    const testClient = new Client({ connectionString: TEST_DB_URL });
    await testClient.connect();

    await resetDatabase({ skipConfirmation: true });
    await seedDatabase();

    // Get a user with subscription
    const { rows: userRows } = await testClient.query(`
      SELECT u.id, u.email
      FROM users u
      JOIN subscriptions s ON u.id = s.user_id
      LIMIT 1
    `);

    if (userRows.length > 0) {
      const userId = userRows[0].id;

      // Delete the user
      await testClient.query('DELETE FROM users WHERE id = $1', [userId]);

      // Verify cascaded deletes
      const { rows: subRows } = await testClient.query(
        'SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(subRows[0].count)).toBe(0);

      const { rows: custRows } = await testClient.query(
        'SELECT COUNT(*) as count FROM customers WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(custRows[0].count)).toBe(0);
    }

    await testClient.end();
  });
});
