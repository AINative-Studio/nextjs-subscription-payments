#!/usr/bin/env node

/**
 * Database Setup Script
 * Sets up the ZeroDB PostgreSQL database with required tables and schema
 *
 * Features:
 * - Idempotent: Safe to run multiple times
 * - Error handling: Graceful failures with detailed messages
 * - Transaction support: All-or-nothing execution
 * - Verification: Confirms all tables and types were created
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Verify that all expected database objects were created
 */
async function verifySchema(client) {
  console.log('\n🔍 Verifying schema...');

  // Check tables
  const expectedTables = ['users', 'customers', 'products', 'prices', 'subscriptions', 'schema_version'];
  const { rows: tables } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  `);

  const tableNames = tables.map(t => t.table_name);
  const missingTables = expectedTables.filter(t => !tableNames.includes(t));

  if (missingTables.length > 0) {
    console.warn(`⚠️  Warning: Missing tables: ${missingTables.join(', ')}`);
  } else {
    console.log(`✅ All ${expectedTables.length} tables created successfully`);
  }

  // Check enum types
  const expectedTypes = ['pricing_type', 'pricing_plan_interval', 'subscription_status'];
  const { rows: types } = await client.query(`
    SELECT typname
    FROM pg_type
    WHERE typtype = 'e'
  `);

  const typeNames = types.map(t => t.typname);
  const missingTypes = expectedTypes.filter(t => !typeNames.includes(t));

  if (missingTypes.length > 0) {
    console.warn(`⚠️  Warning: Missing enum types: ${missingTypes.join(', ')}`);
  } else {
    console.log(`✅ All ${expectedTypes.length} enum types created successfully`);
  }

  // Check indexes
  const { rows: indexes } = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);

  console.log(`✅ ${indexes.length} indexes created`);

  // Check triggers
  const { rows: triggers } = await client.query(`
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
  `);

  console.log(`✅ ${triggers.length} triggers created`);

  return {
    tables: tableNames,
    types: typeNames,
    indexes: indexes.length,
    triggers: triggers.length,
    success: missingTables.length === 0 && missingTypes.length === 0
  };
}

/**
 * Main setup function
 */
async function setupDatabase() {
  // Determine connection string
  const connectionString = process.env.ZERODB_CONNECTION_STRING ||
                          process.env.DATABASE_URL ||
                          'postgresql://localhost:5432/nextjs_subscription';

  console.log('🚀 Starting database setup...');
  console.log(`📍 Connection: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

  const client = new Client({ connectionString });

  try {
    // Connect to database
    console.log('\n📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Read schema file (try database/schema.sql first, fallback to schema.sql)
    console.log('\n📖 Reading schema file...');
    let schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
      console.log('   ℹ️  database/schema.sql not found, trying schema.sql...');
      schemaPath = path.join(__dirname, '..', 'schema.sql');
    }

    if (!fs.existsSync(schemaPath)) {
      throw new Error('Schema file not found at database/schema.sql or schema.sql');
    }

    console.log(`   📄 Using: ${schemaPath}`);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    if (!schema || schema.trim().length === 0) {
      throw new Error('Schema file is empty');
    }

    console.log(`   ✅ Schema loaded (${schema.length} bytes)`);

    // Execute schema
    console.log('\n⚙️  Executing schema...');
    await client.query(schema);
    console.log('✅ Schema executed successfully');

    // Verify schema
    const verification = await verifySchema(client);

    // Display summary
    console.log('\n📊 Setup Summary:');
    console.log(`   • Tables: ${verification.tables.length}`);
    console.log(`   • Enum Types: ${verification.types.length}`);
    console.log(`   • Indexes: ${verification.indexes}`);
    console.log(`   • Triggers: ${verification.triggers}`);

    if (verification.success) {
      console.log('\n✅ Database setup completed successfully! 🎉');
    } else {
      console.log('\n⚠️  Database setup completed with warnings');
    }

    return verification;

  } catch (error) {
    console.error('\n❌ Error setting up database:');

    // Provide helpful error messages
    if (error.code === 'ECONNREFUSED') {
      console.error('   Connection refused. Is PostgreSQL running?');
    } else if (error.code === '28P01') {
      console.error('   Authentication failed. Check your credentials.');
    } else if (error.code === '3D000') {
      console.error('   Database does not exist. Create it first.');
    } else if (error.code === '42P07') {
      console.error('   Object already exists. This is usually safe to ignore.');
    } else {
      console.error(`   ${error.message}`);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
    }

    // Log full error in verbose mode
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
    await setupDatabase();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { setupDatabase, verifySchema };
