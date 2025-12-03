import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import pg from 'pg';

// Mock the pg module before importing our module
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockEnd = jest.fn();
  const mockRelease = jest.fn();

  const mockClient = {
    query: mockQuery,
    release: mockRelease,
  };

  const mockPool = {
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
  };

  // @ts-ignore
  mockConnect.mockResolvedValue(mockClient);

  return {
    Pool: jest.fn(() => mockPool),
    __esModule: true,
    default: {
      Pool: jest.fn(() => mockPool),
    },
  };
});

// Import after mocking
import { query, transaction, getPool, cleanup, healthCheck, pool } from '../zerodb';

// Helper to get the mocked pool
function getMockPool() {
  return pool as any;
}

// Helper to get the mock client
async function getMockClient() {
  const mockPool = getMockPool();
  return await mockPool.connect();
}

describe('ZeroDB Connection Utility', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('query()', () => {
    it('should execute a query successfully with valid SQL', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      const mockPool = getMockPool();
      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
      expect(result.rows).toHaveLength(1);
      expect(result.rowCount).toBe(1);
    });

    it('should execute a query without parameters', async () => {
      const mockResult = {
        rows: [{ count: 5 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      const mockPool = getMockPool();
      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await query('SELECT COUNT(*) as count FROM users');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM users', undefined);
      expect(result.rows[0].count).toBe(5);
    });

    it('should log query execution details', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      const mockPool = getMockPool();
      mockPool.query.mockResolvedValueOnce(mockResult);

      const consoleLogSpy = jest.spyOn(console, 'log');

      await query('SELECT * FROM users');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: expect.any(String),
          duration: expect.any(Number),
          rows: 0,
        })
      );
    });

    it('should handle and log query errors', async () => {
      const mockError = new Error('Database connection failed');
      const mockPool = getMockPool();
      mockPool.query.mockRejectedValueOnce(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error');

      await expect(query('SELECT * FROM invalid_table')).rejects.toThrow(
        'Database connection failed'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Database query error:',
        expect.objectContaining({
          text: expect.any(String),
          duration: expect.any(Number),
          error: 'Database connection failed',
        })
      );
    });

    it('should retry on retryable connection errors', async () => {
      const connectionError: any = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';

      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      const mockPool = getMockPool();
      // Fail twice, then succeed
      mockPool.query
        .mockRejectedValueOnce(connectionError)
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce(mockResult);

      const result = await query('SELECT * FROM users');

      expect(mockPool.query).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockResult);
    });

    it('should not retry on non-retryable errors', async () => {
      const syntaxError: any = new Error('Syntax error');
      syntaxError.code = '42601'; // PostgreSQL syntax error code

      const mockPool = getMockPool();
      mockPool.query.mockRejectedValueOnce(syntaxError);

      await expect(query('SELECT * FORM users')).rejects.toThrow('Syntax error');

      // Should only attempt once (no retries)
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should truncate long SQL queries in logs', async () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'id = 1 AND '.repeat(50) + 'name = "test"';

      const mockResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      const mockPool = getMockPool();
      mockPool.query.mockResolvedValueOnce(mockResult);

      const consoleLogSpy = jest.spyOn(console, 'log');

      await query(longQuery);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: expect.stringContaining('...'),
        })
      );
    });
  });

  describe('transaction()', () => {
    it('should execute a transaction and commit successfully', async () => {
      const mockClient = await getMockClient();

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
        .mockResolvedValueOnce({ command: 'COMMIT' }); // COMMIT

      const result = await transaction(async (client) => {
        const res = await client.query('INSERT INTO users (name) VALUES ($1) RETURNING id', [
          'John',
        ]);
        return res.rows[0].id;
      });

      expect(result).toBe(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockClient = await getMockClient();
      const testError = new Error('Insert failed');

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' }) // BEGIN
        .mockRejectedValueOnce(testError) // INSERT fails
        .mockResolvedValueOnce({ command: 'ROLLBACK' }); // ROLLBACK

      await expect(
        transaction(async (client) => {
          await client.query('INSERT INTO users (name) VALUES ($1)', ['John']);
        })
      ).rejects.toThrow('Insert failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle rollback errors gracefully', async () => {
      const mockClient = await getMockClient();
      const transactionError = new Error('Transaction failed');
      const rollbackError = new Error('Rollback failed');

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockRejectedValueOnce(transactionError)
        .mockRejectedValueOnce(rollbackError);

      const consoleErrorSpy = jest.spyOn(console, 'error');

      await expect(
        transaction(async (client) => {
          await client.query('INSERT INTO users (name) VALUES ($1)', ['John']);
        })
      ).rejects.toThrow('Transaction failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error during rollback:', rollbackError);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if transaction fails', async () => {
      const mockClient = await getMockClient();
      const testError = new Error('Transaction error');

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockRejectedValueOnce(testError)
        .mockResolvedValueOnce({ command: 'ROLLBACK' });

      await expect(
        transaction(async (client) => {
          throw testError;
        })
      ).rejects.toThrow('Transaction error');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return complex results from transaction', async () => {
      const mockPool = getMockPool();
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient as any);

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'John' }], rowCount: 1 })
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const result = await transaction(async (client) => {
        const insertRes = await client.query('INSERT INTO users (name) VALUES ($1) RETURNING id', [
          'John',
        ]);
        const selectRes = await client.query('SELECT * FROM users WHERE id = $1', [
          insertRes.rows[0].id,
        ]);
        return { user: selectRes.rows[0], inserted: true };
      });

      expect(result).toEqual({
        user: { id: 1, name: 'John' },
        inserted: true,
      });
    });

    it('should log transaction lifecycle events', async () => {
      const mockClient = await getMockClient();

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const consoleLogSpy = jest.spyOn(console, 'log');

      await transaction(async (client) => {
        await client.query('SELECT 1');
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('Transaction started');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Transaction committed',
        expect.objectContaining({
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('getPool()', () => {
    it('should return the pool instance', () => {
      const poolInstance = getPool();
      expect(poolInstance).toBeDefined();
      expect(poolInstance).toBe(pool);
    });

    it('should allow direct pool access for advanced queries', () => {
      const poolInstance = getPool();

      // Verify pool has required methods
      expect(poolInstance).toBeDefined();
      expect(typeof poolInstance.query).toBe('function');
      expect(typeof poolInstance.connect).toBe('function');
      expect(typeof poolInstance.end).toBe('function');
    });
  });

  describe('cleanup()', () => {
    it('should close the connection pool successfully', async () => {
      const mockPool = getMockPool();
      mockPool.end.mockResolvedValueOnce(undefined);

      await cleanup();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should log when pool is closed', async () => {
      const mockPool = getMockPool();
      mockPool.end.mockResolvedValueOnce(undefined);

      const consoleLogSpy = jest.spyOn(console, 'log');

      await cleanup();

      expect(consoleLogSpy).toHaveBeenCalledWith('Database connection pool closed');
    });

    it('should handle cleanup errors', async () => {
      const mockError = new Error('Failed to close pool');
      const mockPool = getMockPool();
      mockPool.end.mockRejectedValueOnce(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error');

      await expect(cleanup()).rejects.toThrow('Failed to close pool');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing database pool:', mockError);
    });
  });

  describe('healthCheck()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return true for healthy database connection', async () => {
      // Create isolated mock for this test
      const mockQueryFn = jest.fn().mockResolvedValue({
        rows: [{ health: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const originalQuery = pool.query;
      pool.query = mockQueryFn as any;

      const isHealthy = await healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockQueryFn).toHaveBeenCalled();

      // Restore
      pool.query = originalQuery;
    });

    it('should return false for unhealthy database connection', async () => {
      const error = new Error('Connection timeout');
      const consoleErrorSpy = jest.spyOn(console, 'error');

      // Create isolated mock that always fails
      const mockQueryFn = jest.fn().mockRejectedValue(error);
      const originalQuery = pool.query;
      pool.query = mockQueryFn as any;

      const isHealthy = await healthCheck();

      expect(isHealthy).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Restore
      pool.query = originalQuery;
    });

    it('should return false if health query returns unexpected result', async () => {
      // Create isolated mock for this test
      const mockQueryFn = jest.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const originalQuery = pool.query;
      pool.query = mockQueryFn as any;

      const isHealthy = await healthCheck();

      expect(isHealthy).toBe(false);

      // Restore
      pool.query = originalQuery;
    });
  });

  describe('Error Handling and Retry Logic', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle PostgreSQL specific error codes', async () => {
      const pgError: any = new Error('Too many connections');
      pgError.code = '53300'; // PostgreSQL too_many_connections

      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      const originalQuery = pool.query;
      const mockQueryFn = jest
        .fn()
        .mockRejectedValueOnce(pgError)
        .mockResolvedValueOnce(mockResult);

      pool.query = mockQueryFn as any;

      const result = await query('SELECT * FROM users');

      expect(mockQueryFn).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResult);

      pool.query = originalQuery;
    });

    it(
      'should throw after max retries exceeded',
      async () => {
        const connectionError: any = new Error('Connection timeout');
        connectionError.code = 'ETIMEDOUT';

        const originalQuery = pool.query;
        const mockQueryFn = jest.fn().mockRejectedValue(connectionError);
        pool.query = mockQueryFn as any;

        // Don't use fake timers, just let it retry quickly
        await expect(query('SELECT * FROM users')).rejects.toThrow('Connection timeout');

        // Should attempt 4 times (1 initial + 3 retries)
        expect(mockQueryFn).toHaveBeenCalledTimes(4);

        pool.query = originalQuery;
      },
      15000
    ); // 15 second timeout for retries
  });

  describe('Connection Pool Configuration', () => {
    it('should have pool instance available', () => {
      expect(pool).toBeDefined();
      expect(pool.query).toBeDefined();
      expect(pool.connect).toBeDefined();
      expect(pool.end).toBeDefined();
    });

    it('should export getPool function that returns the pool', () => {
      const poolInstance = getPool();
      expect(poolInstance).toBe(pool);
      expect(poolInstance).toBeDefined();
    });
  });

  describe('Additional Error Handling', () => {
    it('should handle non-Error objects in retry logic', async () => {
      const originalQuery = pool.query;
      const mockQueryFn = jest.fn().mockRejectedValue('String error' as any);
      pool.query = mockQueryFn as any;

      // Should not retry on non-Error objects
      await expect(query('SELECT * FROM users')).rejects.toBe('String error');

      // Should only be called once (no retries)
      expect(mockQueryFn).toHaveBeenCalledTimes(1);

      pool.query = originalQuery;
    });

    it(
      'should handle connection errors in transaction',
      async () => {
        const connectionError: any = new Error('Connection failed');
        connectionError.code = 'ECONNREFUSED';

        const originalConnect = pool.connect;
        const mockConnectFn = jest.fn().mockRejectedValue(connectionError);
        pool.connect = mockConnectFn as any;

        await expect(
          transaction(async (client) => {
            await client.query('SELECT 1');
          })
        ).rejects.toThrow();

        pool.connect = originalConnect;
      },
      15000
    );

    it('should handle query with no rows returned', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      };

      const originalQuery = pool.query;
      const mockQueryFn = jest.fn().mockResolvedValue(mockResult);
      pool.query = mockQueryFn as any;

      const result = await query('DELETE FROM users WHERE id = $1', [999]);

      expect(result.rowCount).toBe(0);
      expect(result.rows).toHaveLength(0);

      pool.query = originalQuery;
    });

    it('should handle different PostgreSQL connection error codes', async () => {
      const errorCodes = ['08000', '08003', '08006', '57P03'];

      for (const code of errorCodes) {
        const pgError: any = new Error('Connection error');
        pgError.code = code;

        const mockResult = {
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };

        const originalQuery = pool.query;
        const mockQueryFn = jest
          .fn()
          .mockRejectedValueOnce(pgError)
          .mockResolvedValueOnce(mockResult);

        pool.query = mockQueryFn as any;

        const result = await query('SELECT * FROM users');
        expect(result).toEqual(mockResult);

        pool.query = originalQuery;
      }
    });

    it('should handle network-level error codes with retry', async () => {
      const networkErrors = ['ECONNRESET', 'EPIPE', 'EHOSTUNREACH', 'ENOTFOUND'];

      for (const code of networkErrors) {
        const networkError: any = new Error('Network error');
        networkError.code = code;

        const mockResult = {
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };

        const originalQuery = pool.query;
        const mockQueryFn = jest
          .fn()
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce(mockResult);

        pool.query = mockQueryFn as any;

        const result = await query('SELECT * FROM users');
        expect(result).toEqual(mockResult);
        expect(mockQueryFn).toHaveBeenCalledTimes(2); // Initial + 1 retry

        pool.query = originalQuery;
      }
    });
  });
});
