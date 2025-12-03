#!/usr/bin/env node

/**
 * Database Reset Script
 * Completely resets the database by dropping all tables, types, and recreating the schema
 *
 * Features:
 * - Drops all tables in correct dependency order
 * - Drops all custom ENUM types
 * - Drops all triggers and functions
 * - Recreates fresh schema using setup-database
 * - Provides confirmation prompt in production
 */

const { Client } = require('pg');
const { setupDatabase } = require('./setup-database');
const readline = require('readline');

/**
 * Prompt user for confirmation
 */
function promptConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Drop all database objects
 */
async function dropAllObjects(client) {
  console.log('\n🗑️  Dropping all database objects...');

  // Drop tables in reverse order of dependencies
  const tables = [
    'subscriptions',
    'customers',
    'prices',
    'products',
    'users',
    'schema_version'
  ];

  console.log('\n📋 Dropping tables...');
  for (const table of tables) {
    try {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`   ✅ Dropped table: ${table}`);
    } catch (error) {
      console.warn(`   ⚠️  Warning: Could not drop table ${table}: ${error.message}`);
    }
  }

  // Drop custom enum types
  const enumTypes = [
    'subscription_status',
    'pricing_plan_interval',
    'pricing_type'
  ];

  console.log('\n🔤 Dropping enum types...');
  for (const enumType of enumTypes) {
    try {
      await client.query(`DROP TYPE IF EXISTS ${enumType} CASCADE;`);
      console.log(`   ✅ Dropped enum type: ${enumType}`);
    } catch (error) {
      console.warn(`   ⚠️  Warning: Could not drop enum type ${enumType}: ${error.message}`);
    }
  }

  // Drop trigger function
  console.log('\n⚡ Dropping trigger functions...');
  try {
    await client.query(`DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;`);
    console.log(`   ✅ Dropped function: update_updated_at_column`);
  } catch (error) {
    console.warn(`   ⚠️  Warning: Could not drop function: ${error.message}`);
  }

  // Verify cleanup
  const { rows: remainingTables } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  `);

  const { rows: remainingTypes } = await client.query(`
    SELECT typname
    FROM pg_type
    WHERE typtype = 'e'
  `);

  if (remainingTables.length > 0) {
    console.warn(`\n⚠️  Warning: ${remainingTables.length} tables still exist:`);
    remainingTables.forEach(t => console.warn(`   - ${t.table_name}`));
  } else {
    console.log('\n✅ All tables dropped successfully');
  }

  if (remainingTypes.length > 0) {
    console.warn(`\n⚠️  Warning: ${remainingTypes.length} enum types still exist:`);
    remainingTypes.forEach(t => console.warn(`   - ${t.typname}`));
  } else {
    console.log('✅ All enum types dropped successfully');
  }

  return {
    tablesDropped: tables.length,
    typesDropped: enumTypes.length,
    remainingTables: remainingTables.length,
    remainingTypes: remainingTypes.length
  };
}

/**
 * Main reset function
 */
async function resetDatabase(options = {}) {
  const skipConfirmation = options.skipConfirmation || process.env.SKIP_CONFIRMATION === 'true';
  const connectionString = process.env.ZERODB_CONNECTION_STRING ||
                          process.env.DATABASE_URL ||
                          'postgresql://localhost:5432/nextjs_subscription';

  console.log('🔄 Starting database reset...');
  console.log(`📍 Connection: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

  // Confirmation in production
  if (!skipConfirmation && process.env.NODE_ENV === 'production') {
    console.log('\n⚠️  WARNING: You are about to reset the PRODUCTION database!');
    console.log('   This will DELETE ALL DATA permanently.');
    const confirmed = await promptConfirmation('\nAre you ABSOLUTELY sure you want to continue?');

    if (!confirmed) {
      console.log('\n❌ Reset cancelled by user');
      return { cancelled: true };
    }
  } else if (!skipConfirmation) {
    console.log('\n⚠️  WARNING: This will delete all data in the database!');
    const confirmed = await promptConfirmation('\nDo you want to continue?');

    if (!confirmed) {
      console.log('\n❌ Reset cancelled by user');
      return { cancelled: true };
    }
  }

  const client = new Client({ connectionString });

  try {
    // Connect to database
    console.log('\n📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Drop all objects
    const dropResult = await dropAllObjects(client);

    // Close connection before recreating schema
    await client.end();
    console.log('\n🔌 Database connection closed');

    // Recreate schema
    console.log('\n🔨 Recreating database schema...');
    const setupResult = await setupDatabase();

    // Display summary
    console.log('\n📊 Reset Summary:');
    console.log(`   • Tables dropped: ${dropResult.tablesDropped}`);
    console.log(`   • Enum types dropped: ${dropResult.typesDropped}`);
    console.log(`   • Tables recreated: ${setupResult.tables.length}`);
    console.log(`   • Enum types recreated: ${setupResult.types.length}`);

    console.log('\n✅ Database reset completed successfully! 🔄');

    return {
      cancelled: false,
      ...dropResult,
      ...setupResult
    };

  } catch (error) {
    console.error('\n❌ Error resetting database:');

    // Provide helpful error messages
    if (error.code === 'ECONNREFUSED') {
      console.error('   Connection refused. Is PostgreSQL running?');
    } else if (error.code === '28P01') {
      console.error('   Authentication failed. Check your credentials.');
    } else if (error.code === '3D000') {
      console.error('   Database does not exist. Create it first.');
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
    // Ensure connection is closed
    try {
      if (client._connected) {
        await client.end();
      }
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
    const result = await resetDatabase();

    if (result.cancelled) {
      process.exit(0);
    }

    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { resetDatabase, dropAllObjects };
