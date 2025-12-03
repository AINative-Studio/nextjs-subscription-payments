#!/usr/bin/env node

/**
 * Database Reset Script
 * Drops all tables and recreates the database schema
 */

const { Client } = require('pg');
const { setupDatabase } = require('./setup-database');

async function resetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/nextjs_subscription',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Dropping all tables...');

    // Drop tables in reverse order of dependencies
    const tables = [
      'subscriptions',
      'customers',
      'prices',
      'products',
      'users'
    ];

    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`Dropped table: ${table}`);
    }

    await client.end();

    console.log('Recreating schema...');
    await setupDatabase();

    console.log('Database reset completed successfully!');
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    if (client._connected) {
      await client.end();
    }
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };
