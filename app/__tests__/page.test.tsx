/**
 * Tests for app/page.tsx - Pricing Page
 * Tests SQL queries, authentication, and data fetching
 */

import { query } from '@/lib/zerodb';
import { getUser } from '@/lib/auth';
import { cookies } from 'next/headers';

// Mock dependencies
jest.mock('@/lib/zerodb');
jest.mock('@/lib/auth');
jest.mock('next/headers');
jest.mock('@/components/ui/Pricing/Pricing', () => {
  return function MockPricing() {
    return <div data-testid="pricing-component">Pricing</div>;
  };
});

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

describe('Pricing Page - Data Fetching Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches active products successfully', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    const mockProducts = [
      {
        id: 'prod_1',
        active: true,
        name: 'Starter',
        description: 'Basic plan',
        image: null,
        metadata: { index: '1' },
        prices: [],
      },
    ];

    mockQuery.mockResolvedValueOnce({
      rows: mockProducts,
      rowCount: 1,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM products p')
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE p.active = true')
    );
  });

  it('fetches associated prices for each product', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    const mockProducts = [
      {
        id: 'prod_1',
        active: true,
        name: 'Starter',
        description: 'Basic plan',
        image: null,
        metadata: { index: '1' },
        prices: [
          {
            id: 'price_1',
            unit_amount: 1000,
            currency: 'usd',
            interval: 'month',
          },
        ],
      },
    ];

    mockQuery.mockResolvedValueOnce({
      rows: mockProducts,
      rowCount: 1,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN prices pr')
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('json_agg')
    );
  });

  it('handles empty products list', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    const result = await PricingPage();

    expect(result).toBeDefined();
  });

  it('handles products without prices', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    const mockProducts = [
      {
        id: 'prod_1',
        active: true,
        name: 'Starter',
        description: 'Basic plan',
        image: null,
        metadata: { index: '1' },
        prices: [],
      },
    ];

    mockQuery.mockResolvedValueOnce({
      rows: mockProducts,
      rowCount: 1,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    const result = await PricingPage();

    expect(result).toBeDefined();
  });

  it('orders products by metadata index', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY CAST(p.metadata->>'index' AS INTEGER)")
    );
  });

  it('filters out inactive products', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE p.active = true')
    );
  });

  it('filters out inactive prices', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('pr.active = true')
    );
  });

  it('handles database connection errors', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

    const PricingPage = (await import('@/app/page')).default;

    await expect(PricingPage()).rejects.toThrow('Connection failed');
  });
});

describe('Pricing Page - Authentication Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('continues as guest when no token present', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('fetches user with valid token', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockGetUser).toHaveBeenCalledWith(mockToken);
  });

  it('continues as guest with invalid token', async () => {
    const mockToken = 'invalid-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    mockGetUser.mockRejectedValueOnce(new Error('Invalid token'));

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockGetUser).toHaveBeenCalledWith(mockToken);
  });

  it('fetches subscription when user is authenticated', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM subscriptions s'),
      [mockUser.id]
    );
  });

  it('does not fetch subscription when user is not authenticated', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('Pricing Page - Subscription Fetching Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches active subscription', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)
      .mockResolvedValueOnce({
        rows: [{ id: 'sub_1', status: 'active' }],
        rowCount: 1,
      } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("s.status IN ('trialing', 'active')"),
      expect.any(Array)
    );
  });

  it('includes nested price and product data', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('json_build_object'),
      expect.any(Array)
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN prices pr'),
      expect.any(Array)
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN products p'),
      expect.any(Array)
    );
  });

  it('returns null if no active subscription', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('returns most recent subscription when multiple exist', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY s.created DESC'),
      expect.any(Array)
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 1'),
      expect.any(Array)
    );
  });
});

describe('Pricing Page - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with real data structure', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    const mockProducts = [
      {
        id: 'prod_1',
        active: true,
        name: 'Starter',
        description: 'Basic plan',
        image: null,
        metadata: { index: '1' },
        prices: [
          {
            id: 'price_1',
            product_id: 'prod_1',
            active: true,
            description: null,
            unit_amount: 1000,
            currency: 'usd',
            type: 'recurring',
            interval: 'month',
            interval_count: 1,
            trial_period_days: null,
            metadata: {},
          },
        ],
      },
    ];

    mockQuery.mockResolvedValueOnce({
      rows: mockProducts,
      rowCount: 1,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    const result = await PricingPage();

    expect(result).toBeDefined();
  });

  it('tests SQL JOIN results structure', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN prices pr ON pr.product_id = p.id')
    );
  });

  it('tests json_agg aggregation', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('json_agg')
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE')
    );
  });

  it('tests metadata ordering with CAST', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    const PricingPage = (await import('@/app/page')).default;
    await PricingPage();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CAST(p.metadata->>'index' AS INTEGER)")
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('NULLS LAST')
    );
  });
});
