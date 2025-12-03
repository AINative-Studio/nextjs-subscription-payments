import pg from 'pg';

const { Pool } = pg;

// Connection pool configuration
const poolConfig: pg.PoolConfig = {
  connectionString: process.env.ZERODB_CONNECTION_STRING,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout for new connections
};

// Initialize the connection pool
const pool = new Pool(poolConfig);

// Connection retry configuration
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2,
};

/**
 * Helper function to implement exponential backoff retry logic
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;
  let delay = retryConfig.retryDelay;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's the last attempt
      if (attempt === retryConfig.maxRetries) {
        break;
      }

      // Check if error is retryable (connection errors, timeouts, etc.)
      const isRetryable = isRetryableError(error);
      if (!isRetryable) {
        throw error;
      }

      console.warn(
        `Database operation failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}). Retrying in ${delay}ms...`,
        { error: lastError.message }
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay *= retryConfig.backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const retryableErrorCodes = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'EPIPE',
    'ECONNRESET',
  ];

  const pgError = error as pg.DatabaseError;

  // Retry on connection errors
  if (pgError.code && retryableErrorCodes.includes(pgError.code)) {
    return true;
  }

  // Retry on temporary PostgreSQL errors
  const retryablePgCodes = [
    '08000', // connection_exception
    '08003', // connection_does_not_exist
    '08006', // connection_failure
    '57P03', // cannot_connect_now
    '53300', // too_many_connections
  ];

  if (pgError.code && retryablePgCodes.includes(pgError.code)) {
    return true;
  }

  return false;
}

/**
 * Execute a SQL query with automatic logging and error handling
 * @param text - SQL query string
 * @param params - Query parameters (optional)
 * @returns Query result
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();

  try {
    const operation = async () => {
      const res = await pool.query<T>(text, params);
      const duration = Date.now() - start;

      console.log('Executed query', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration,
        rows: res.rowCount,
      });

      return res;
    };

    return await retryWithBackoff(operation);
  } catch (error) {
    const duration = Date.now() - start;
    console.error('Database query error:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute multiple queries within a transaction
 * @param callback - Function that receives a client and executes queries
 * @returns Result from the callback function
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const start = Date.now();
  let client: pg.PoolClient | undefined;

  try {
    // Get a client from the pool with retry logic
    client = await retryWithBackoff(() => pool.connect());

    // Begin transaction
    await client.query('BEGIN');
    console.log('Transaction started');

    // Execute callback with the client
    const result = await callback(client);

    // Commit transaction
    await client.query('COMMIT');
    const duration = Date.now() - start;
    console.log('Transaction committed', { duration });

    return result;
  } catch (error) {
    // Rollback on error
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('Transaction rolled back');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }

    const duration = Date.now() - start;
    console.error('Transaction failed:', {
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
  }
}

/**
 * Get the connection pool instance for advanced use cases
 * @returns The PostgreSQL connection pool
 */
export function getPool(): pg.Pool {
  return pool;
}

/**
 * Clean up and close all connections in the pool
 * Should be called when shutting down the application
 */
export async function cleanup(): Promise<void> {
  try {
    await pool.end();
    console.log('Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
}

/**
 * Check if the database connection is healthy
 * @returns True if connection is healthy, false otherwise
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 AS health');
    return result.rows.length > 0 && result.rows[0].health === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Export the pool for advanced use cases
export { pool };

// Handle process termination gracefully
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });
}
