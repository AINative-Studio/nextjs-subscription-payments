/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).ts', '**/?(*.)+(spec|test).js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/**/*.{ts,tsx}',
    'utils/**/*.ts',
    'scripts/**/*.js',
    '!lib/**/*.d.ts',
    '!lib/**/__tests__/**',
    '!lib/**/*.test.ts',
    '!app/**/__tests__/**',
    '!app/**/*.test.{ts,tsx}',
    '!utils/**/__tests__/**',
    '!utils/**/*.test.ts',
    '!scripts/**/*.test.js',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: 'node',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
};

module.exports = config;
