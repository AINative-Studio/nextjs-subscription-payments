#!/usr/bin/env node

/**
 * Database Setup Script
 * Sets up the PostgreSQL database with required tables and schema
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/nextjs_subscription',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema...');
    await client.query(schema);

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
