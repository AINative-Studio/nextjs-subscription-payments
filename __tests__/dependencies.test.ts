/**
 * Dependency Verification Tests
 *
 * These tests verify that the migration from Supabase to PostgreSQL
 * is complete and all dependencies are correctly configured.
 */

import fs from 'fs';
import path from 'path';

describe('Dependency Migration Tests', () => {
  let packageJson: any;
  let pnpmLock: string;

  beforeAll(() => {
    // Load package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // Load pnpm-lock.yaml
    const lockPath = path.join(process.cwd(), 'pnpm-lock.yaml');
    pnpmLock = fs.readFileSync(lockPath, 'utf8');
  });

  describe('PostgreSQL Dependencies', () => {
    test('should have pg package in dependencies', () => {
      expect(packageJson.dependencies).toHaveProperty('pg');
      expect(typeof packageJson.dependencies.pg).toBe('string');
    });

    test('should have @types/pg in devDependencies', () => {
      expect(packageJson.devDependencies).toHaveProperty('@types/pg');
      expect(typeof packageJson.devDependencies['@types/pg']).toBe('string');
    });

    test('pg package should be version 8.11.0 or higher', () => {
      const version = packageJson.dependencies.pg.replace(/[\^~]/, '');
      const [major, minor] = version.split('.').map(Number);

      expect(major).toBeGreaterThanOrEqual(8);
      if (major === 8) {
        expect(minor).toBeGreaterThanOrEqual(11);
      }
    });

    test('@types/pg should be version 8.11.0 or higher', () => {
      const version = packageJson.devDependencies['@types/pg'].replace(/[\^~]/, '');
      const [major, minor] = version.split('.').map(Number);

      expect(major).toBeGreaterThanOrEqual(8);
      if (major === 8) {
        expect(minor).toBeGreaterThanOrEqual(11);
      }
    });
  });

  describe('Supabase Dependencies Removal', () => {
    const supabasePackages = [
      '@supabase/supabase-js',
      '@supabase/ssr',
      '@supabase/auth-helpers-nextjs',
      '@supabase/auth-helpers-react',
      'supabase'
    ];

    supabasePackages.forEach(packageName => {
      test(`should NOT have ${packageName} in dependencies`, () => {
        expect(packageJson.dependencies).not.toHaveProperty(packageName);
      });

      test(`should NOT have ${packageName} in devDependencies`, () => {
        expect(packageJson.devDependencies).not.toHaveProperty(packageName);
      });
    });

    test('should not have any Supabase-related packages in package.json', () => {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...(packageJson.peerDependencies || {})
      };

      const supabaseDeps = Object.keys(allDeps).filter(dep =>
        dep.toLowerCase().includes('supabase')
      );

      expect(supabaseDeps).toHaveLength(0);
    });
  });

  describe('Database Scripts', () => {
    const requiredScripts = [
      'db:setup',
      'db:seed',
      'db:reset'
    ];

    requiredScripts.forEach(scriptName => {
      test(`should have ${scriptName} script`, () => {
        expect(packageJson.scripts).toHaveProperty(scriptName);
        expect(typeof packageJson.scripts[scriptName]).toBe('string');
        expect(packageJson.scripts[scriptName]).not.toBe('');
      });
    });

    test('db:setup script should reference setup-database.js', () => {
      expect(packageJson.scripts['db:setup']).toContain('setup-database.js');
    });

    test('db:seed script should reference seed-database.js', () => {
      expect(packageJson.scripts['db:seed']).toContain('seed-database.js');
    });

    test('db:reset script should reference reset-database.js', () => {
      expect(packageJson.scripts['db:reset']).toContain('reset-database.js');
    });
  });

  describe('Testing Configuration', () => {
    test('should have test script configured', () => {
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts.test).toBeTruthy();
    });

    test('should have test:coverage script configured', () => {
      expect(packageJson.scripts).toHaveProperty('test:coverage');
      expect(packageJson.scripts['test:coverage']).toContain('coverage');
    });

    test('should have test:watch script configured', () => {
      expect(packageJson.scripts).toHaveProperty('test:watch');
      expect(packageJson.scripts['test:watch']).toContain('watch');
    });
  });

  describe('Lock File Validation', () => {
    test('pnpm-lock.yaml should exist and be valid', () => {
      expect(pnpmLock).toBeTruthy();
      expect(pnpmLock.length).toBeGreaterThan(0);
    });

    test('pnpm-lock.yaml should contain pg package', () => {
      expect(pnpmLock).toContain('pg');
    });

    test('pnpm-lock.yaml should contain @types/pg package', () => {
      expect(pnpmLock).toContain('@types/pg');
    });

    test('pnpm-lock.yaml should have valid YAML structure', () => {
      // Check for basic YAML structure markers
      expect(pnpmLock).toContain('lockfileVersion:');
      expect(pnpmLock).toContain('dependencies:');
    });
  });

  describe('Required Development Dependencies', () => {
    test('should have TypeScript in devDependencies', () => {
      expect(packageJson.devDependencies).toHaveProperty('typescript');
    });

    test('should have Jest in devDependencies', () => {
      expect(packageJson.devDependencies).toHaveProperty('jest');
    });

    test('should have ts-jest in devDependencies', () => {
      expect(packageJson.devDependencies).toHaveProperty('ts-jest');
    });

    test('should have @types/jest in devDependencies', () => {
      expect(packageJson.devDependencies).toHaveProperty('@types/jest');
    });

    test('should have @types/node in devDependencies', () => {
      expect(packageJson.devDependencies).toHaveProperty('@types/node');
    });
  });

  describe('Package.json Structure', () => {
    test('should be a valid package.json object', () => {
      expect(packageJson).toBeDefined();
      expect(typeof packageJson).toBe('object');
      // Name is optional for private packages
      if (packageJson.name) {
        expect(typeof packageJson.name).toBe('string');
      }
    });

    test('should have private property set to true', () => {
      expect(packageJson).toHaveProperty('private');
      expect(packageJson.private).toBe(true);
    });

    test('should have scripts property', () => {
      expect(packageJson).toHaveProperty('scripts');
      expect(typeof packageJson.scripts).toBe('object');
    });

    test('should have dependencies property', () => {
      expect(packageJson).toHaveProperty('dependencies');
      expect(typeof packageJson.dependencies).toBe('object');
    });

    test('should have devDependencies property', () => {
      expect(packageJson).toHaveProperty('devDependencies');
      expect(typeof packageJson.devDependencies).toBe('object');
    });
  });

  describe('Version Constraints', () => {
    test('all dependencies should have version constraints', () => {
      const deps = packageJson.dependencies;

      Object.entries(deps).forEach(([name, version]) => {
        expect(version).toBeTruthy();
        expect(typeof version).toBe('string');
        expect((version as string).length).toBeGreaterThan(0);
      });
    });

    test('all devDependencies should have version constraints', () => {
      const devDeps = packageJson.devDependencies;

      Object.entries(devDeps).forEach(([name, version]) => {
        expect(version).toBeTruthy();
        expect(typeof version).toBe('string');
        expect((version as string).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Essential Scripts Presence', () => {
    const essentialScripts = [
      'dev',
      'build',
      'start',
      'lint'
    ];

    essentialScripts.forEach(scriptName => {
      test(`should have ${scriptName} script`, () => {
        expect(packageJson.scripts).toHaveProperty(scriptName);
        expect(packageJson.scripts[scriptName]).toBeTruthy();
      });
    });
  });
});

describe('File System Structure', () => {
  describe('Database Scripts Files', () => {
    const scriptFiles = [
      'scripts/setup-database.js',
      'scripts/seed-database.js',
      'scripts/reset-database.js'
    ];

    scriptFiles.forEach(scriptPath => {
      test(`${scriptPath} should exist`, () => {
        const fullPath = path.join(process.cwd(), scriptPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });

      test(`${scriptPath} should be readable`, () => {
        const fullPath = path.join(process.cwd(), scriptPath);
        const stats = fs.statSync(fullPath);
        expect(stats.isFile()).toBe(true);
      });

      test(`${scriptPath} should contain valid JavaScript`, () => {
        const fullPath = path.join(process.cwd(), scriptPath);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Should have shebang for Node.js
        expect(content).toContain('#!/usr/bin/env node');

        // Should import pg Client
        expect(content).toContain('require(\'pg\')');
      });
    });
  });

  describe('Configuration Files', () => {
    test('jest.config.js should exist', () => {
      const configPath = path.join(process.cwd(), 'jest.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    test('tsconfig.json should exist', () => {
      const configPath = path.join(process.cwd(), 'tsconfig.json');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    test('.env.example should exist', () => {
      const envPath = path.join(process.cwd(), '.env.example');
      expect(fs.existsSync(envPath)).toBe(true);
    });
  });

  describe('Test Directory', () => {
    test('__tests__ directory should exist', () => {
      const testsDir = path.join(process.cwd(), '__tests__');
      expect(fs.existsSync(testsDir)).toBe(true);
    });

    test('__tests__ should be a directory', () => {
      const testsDir = path.join(process.cwd(), '__tests__');
      const stats = fs.statSync(testsDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });
});
