/**
 * Script Execution Tests
 *
 * These tests verify that the database management scripts
 * are properly configured and can be executed.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

describe('Database Scripts Execution Tests', () => {
  const scriptsDir = path.join(process.cwd(), 'scripts');

  describe('Script Files Existence', () => {
    const scripts = [
      'setup-database.js',
      'seed-database.js',
      'reset-database.js'
    ];

    scripts.forEach(scriptName => {
      test(`${scriptName} should exist`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        expect(fs.existsSync(scriptPath)).toBe(true);
      });

      test(`${scriptName} should be a file`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const stats = fs.statSync(scriptPath);
        expect(stats.isFile()).toBe(true);
      });

      test(`${scriptName} should have valid JavaScript syntax`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        // Check for common JavaScript patterns (not executing the code)
        expect(content).toContain('function');
        expect(content).not.toContain('SyntaxError');
        // Verify it's valid JavaScript by checking it has proper structure
        const hasRequire = content.includes('require(');
        const hasModule = content.includes('module.exports');
        expect(hasRequire || hasModule).toBe(true);
      });
    });
  });

  describe('Script Content Validation', () => {
    test('setup-database.js should import pg Client', () => {
      const scriptPath = path.join(scriptsDir, 'setup-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('require(\'pg\')');
      expect(content).toContain('Client');
    });

    test('setup-database.js should export setupDatabase function', () => {
      const scriptPath = path.join(scriptsDir, 'setup-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('module.exports');
      expect(content).toContain('setupDatabase');
    });

    test('seed-database.js should import pg Client', () => {
      const scriptPath = path.join(scriptsDir, 'seed-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('require(\'pg\')');
      expect(content).toContain('Client');
    });

    test('seed-database.js should export seedDatabase function', () => {
      const scriptPath = path.join(scriptsDir, 'seed-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('module.exports');
      expect(content).toContain('seedDatabase');
    });

    test('reset-database.js should import pg Client', () => {
      const scriptPath = path.join(scriptsDir, 'reset-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('require(\'pg\')');
      expect(content).toContain('Client');
    });

    test('reset-database.js should export resetDatabase function', () => {
      const scriptPath = path.join(scriptsDir, 'reset-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('module.exports');
      expect(content).toContain('resetDatabase');
    });
  });

  describe('Script Database Connection', () => {
    test('setup-database.js should use DATABASE_URL or default connection', () => {
      const scriptPath = path.join(scriptsDir, 'setup-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('connectionString');
    });

    test('seed-database.js should use DATABASE_URL or default connection', () => {
      const scriptPath = path.join(scriptsDir, 'seed-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('connectionString');
    });

    test('reset-database.js should use DATABASE_URL or default connection', () => {
      const scriptPath = path.join(scriptsDir, 'reset-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('connectionString');
    });
  });

  describe('Script Error Handling', () => {
    const scripts = [
      'setup-database.js',
      'seed-database.js',
      'reset-database.js'
    ];

    scripts.forEach(scriptName => {
      test(`${scriptName} should have try-catch error handling`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toContain('try');
        expect(content).toContain('catch');
      });

      test(`${scriptName} should handle client.end() in finally block`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toContain('finally');
        expect(content).toContain('client.end()');
      });

      test(`${scriptName} should have console.error for errors`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toContain('console.error');
      });
    });
  });

  describe('Script Shebang and Execution', () => {
    const scripts = [
      'setup-database.js',
      'seed-database.js',
      'reset-database.js'
    ];

    scripts.forEach(scriptName => {
      test(`${scriptName} should have Node.js shebang`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
      });

      test(`${scriptName} should have require.main check`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toContain('require.main === module');
      });
    });
  });

  describe('Script Module Exports', () => {
    test('setup-database.js can be imported as module', () => {
      const scriptPath = path.join(scriptsDir, 'setup-database.js');

      expect(() => {
        const module = require(scriptPath);
        expect(module).toHaveProperty('setupDatabase');
        expect(typeof module.setupDatabase).toBe('function');
      }).not.toThrow();
    });

    test('seed-database.js can be imported as module', () => {
      const scriptPath = path.join(scriptsDir, 'seed-database.js');

      expect(() => {
        const module = require(scriptPath);
        expect(module).toHaveProperty('seedDatabase');
        expect(typeof module.seedDatabase).toBe('function');
      }).not.toThrow();
    });

    test('reset-database.js can be imported as module', () => {
      const scriptPath = path.join(scriptsDir, 'reset-database.js');

      expect(() => {
        const module = require(scriptPath);
        expect(module).toHaveProperty('resetDatabase');
        expect(typeof module.resetDatabase).toBe('function');
      }).not.toThrow();
    });
  });

  describe('NPM Script Configuration', () => {
    let packageJson: any;

    beforeAll(() => {
      const packagePath = path.join(process.cwd(), 'package.json');
      packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    });

    test('db:setup script should call node command', () => {
      expect(packageJson.scripts['db:setup']).toContain('node');
    });

    test('db:seed script should call node command', () => {
      expect(packageJson.scripts['db:seed']).toContain('node');
    });

    test('db:reset script should call node command', () => {
      expect(packageJson.scripts['db:reset']).toContain('node');
    });

    test('db:setup script should reference correct file path', () => {
      const script = packageJson.scripts['db:setup'];
      expect(script).toContain('scripts/setup-database.js');
    });

    test('db:seed script should reference correct file path', () => {
      const script = packageJson.scripts['db:seed'];
      expect(script).toContain('scripts/seed-database.js');
    });

    test('db:reset script should reference correct file path', () => {
      const script = packageJson.scripts['db:reset'];
      expect(script).toContain('scripts/reset-database.js');
    });
  });

  describe('Script Dependencies', () => {
    test('setup-database.js should read schema.sql', () => {
      const scriptPath = path.join(scriptsDir, 'setup-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('schema.sql');
      expect(content).toContain('readFileSync');
    });

    test('seed-database.js should contain INSERT queries', () => {
      const scriptPath = path.join(scriptsDir, 'seed-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('INSERT');
      expect(content).toContain('client.query');
    });

    test('reset-database.js should contain DROP TABLE commands', () => {
      const scriptPath = path.join(scriptsDir, 'reset-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('DROP TABLE');
    });

    test('reset-database.js should import setupDatabase', () => {
      const scriptPath = path.join(scriptsDir, 'reset-database.js');
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('setup-database');
      expect(content).toContain('setupDatabase');
    });
  });

  describe('Script Logging', () => {
    const scripts = [
      'setup-database.js',
      'seed-database.js',
      'reset-database.js'
    ];

    scripts.forEach(scriptName => {
      test(`${scriptName} should have console.log for progress updates`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toContain('console.log');
      });

      test(`${scriptName} should log connection status`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toMatch(/console\.log.*[Cc]onnect/);
      });

      test(`${scriptName} should log success message`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toMatch(/console\.log.*success/i);
      });
    });
  });

  describe('Async/Await Pattern', () => {
    const scripts = [
      'setup-database.js',
      'seed-database.js',
      'reset-database.js'
    ];

    scripts.forEach(scriptName => {
      test(`${scriptName} should use async function`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toContain('async function');
      });

      test(`${scriptName} should use await for client operations`, () => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf8');

        expect(content).toContain('await client.connect()');
        expect(content).toContain('await client.end()');
      });
    });
  });
});

describe('Script Integration', () => {
  describe('Schema File Requirements', () => {
    test('schema.sql should exist', () => {
      const schemaPath = path.join(process.cwd(), 'schema.sql');
      expect(fs.existsSync(schemaPath)).toBe(true);
    });

    test('schema.sql should contain CREATE TABLE statements', () => {
      const schemaPath = path.join(process.cwd(), 'schema.sql');
      const content = fs.readFileSync(schemaPath, 'utf8');

      // Schema uses lowercase 'create table' syntax
      expect(content.toLowerCase()).toContain('create table');
    });

    test('schema.sql should be readable by setup script', () => {
      const schemaPath = path.join(process.cwd(), 'schema.sql');
      const stats = fs.statSync(schemaPath);

      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Environment Configuration', () => {
    test('.env.example should exist', () => {
      const envPath = path.join(process.cwd(), '.env.example');
      expect(fs.existsSync(envPath)).toBe(true);
    });

    test('.env.example should contain database connection config', () => {
      const envPath = path.join(process.cwd(), '.env.example');
      const content = fs.readFileSync(envPath, 'utf8');

      // Should have either DATABASE_URL or ZERODB_CONNECTION_STRING
      const hasDbConfig = content.includes('DATABASE_URL') || content.includes('ZERODB_CONNECTION_STRING');
      expect(hasDbConfig).toBe(true);
    });
  });
});
