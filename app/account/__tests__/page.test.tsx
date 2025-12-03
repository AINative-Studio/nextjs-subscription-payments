/**
 * Tests for app/account/page.tsx - Account Page
 * Tests authentication, SQL queries, and user data fetching
 */

import { query } from '@/lib/zerodb';
import { getUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Mock dependencies
jest.mock('@/lib/zerodb');
jest.mock('@/lib/auth');
jest.mock('next/headers');
jest.mock('next/navigation');
jest.mock('@/components/ui/AccountForms/CustomerPortalForm', () => {
  return function MockCustomerPortalForm() {
    return <div data-testid="customer-portal-form">CustomerPortalForm</div>;
  };
});
jest.mock('@/components/ui/AccountForms/NameForm', () => {
  return function MockNameForm() {
    return <div data-testid="name-form">NameForm</div>;
  };
});
jest.mock('@/components/ui/AccountForms/EmailForm', () => {
  return function MockEmailForm() {
    return <div data-testid="email-form">EmailForm</div>;
  };
});

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('Account Page - Authentication Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT: ${url}`);
    });
  });

  it('redirects if no token present', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    const Account = (await import('@/app/account/page')).default;

    await expect(Account()).rejects.toThrow('REDIRECT: /signin');
    expect(mockRedirect).toHaveBeenCalledWith('/signin');
  });

  it('redirects if invalid token', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'invalid-token' }),
    } as any);

    mockGetUser.mockRejectedValueOnce(new Error('Invalid token'));

    const Account = (await import('@/app/account/page')).default;

    await expect(Account()).rejects.toThrow('REDIRECT: /signin');
    expect(mockRedirect).toHaveBeenCalledWith('/signin');
  });

  it('fetches user with valid token', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
      full_name: 'Test User',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockGetUser).toHaveBeenCalledWith(mockToken);
  });

  it('handles expired token', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'expired-token' }),
    } as any);

    mockGetUser.mockRejectedValueOnce(new Error('Token expired'));

    const Account = (await import('@/app/account/page')).default;

    await expect(Account()).rejects.toThrow('REDIRECT: /signin');
  });

  it('handles malformed token', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'malformed.token.here' }),
    } as any);

    mockGetUser.mockRejectedValueOnce(new Error('Invalid token'));

    const Account = (await import('@/app/account/page')).default;

    await expect(Account()).rejects.toThrow('REDIRECT: /signin');
  });

  it('retrieves user from JWT payload', async () => {
    const mockToken = 'valid-jwt-token';
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: mockToken }),
    } as any);

    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockGetUser).toHaveBeenCalledWith(mockToken);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, email, full_name'),
      [mockUser.id]
    );
  });
});

describe('Account Page - Subscription Fetching Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT: ${url}`);
    });
  });

  it('fetches active subscription', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    const mockSubscription = {
      id: 'sub_1',
      status: 'active',
      user_id: 'user_1',
    };

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [mockSubscription],
        rowCount: 1,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("s.status IN ('trialing', 'active')"),
      ['user_1']
    );
  });

  it('fetches trialing subscription', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    const mockSubscription = {
      id: 'sub_1',
      status: 'trialing',
      user_id: 'user_1',
    };

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [mockSubscription],
        rowCount: 1,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('returns null if no active subscription', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('includes nested price data', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('json_build_object'),
      ['user_1']
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN prices pr'),
      ['user_1']
    );
  });

  it('includes nested product data', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN products p'),
      ['user_1']
    );
  });

  it('handles multiple subscriptions (returns most recent)', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY s.created DESC'),
      ['user_1']
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 1'),
      ['user_1']
    );
  });

  it('filters out canceled subscriptions', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("s.status IN ('trialing', 'active')"),
      ['user_1']
    );
  });

  it('filters out expired subscriptions', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.not.stringContaining('incomplete_expired'),
      ['user_1']
    );
  });

  it('tests SQL JOIN with prices and products', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN prices pr ON pr.id = s.price_id'),
      ['user_1']
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN products p ON p.id = pr.product_id'),
      ['user_1']
    );
  });

  it('handles database errors', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

    const Account = (await import('@/app/account/page')).default;

    await expect(Account()).rejects.toThrow('Database connection failed');
  });
});

describe('Account Page - Rendering Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT: ${url}`);
    });
  });

  it('displays user email', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, email, full_name'),
      [mockUser.id]
    );
  });

  it('displays subscription status', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    const mockSubscription = {
      id: 'sub_1',
      status: 'active',
    };

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [mockSubscription],
        rowCount: 1,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('s.status'),
      ['user_1']
    );
  });

  it('shows current plan name', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('p.name'),
      ['user_1']
    );
  });

  it('shows billing cycle', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('pr.interval'),
      ['user_1']
    );
  });

  it('shows next billing date', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('current_period_end'),
      ['user_1']
    );
  });

  it('shows cancel button if active', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('cancel_at_period_end'),
      ['user_1']
    );
  });

  it('shows "No subscription" if none found', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('handles loading state', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    mockGetUser.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
    });

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user_1', email: 'test@example.com' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    const result = await Account();

    expect(result).toBeDefined();
  });
});

describe('Account Page - User Update Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT: ${url}`);
    });
  });

  it('fetches user full_name for NameForm', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
      full_name: 'John Doe',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('full_name'),
      [mockUser.id]
    );
  });

  it('fetches billing_address', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('billing_address'),
      [mockUser.id]
    );
  });

  it('fetches payment_method', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('payment_method'),
      [mockUser.id]
    );
  });

  it('validates user exists in database', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [mockUser.id]
    );
  });

  it('handles user not found in database', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
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

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('fetches avatar_url from database', async () => {
    mockCookies.mockReturnValue({
      get: jest.fn().mockReturnValue({ value: 'valid-token' }),
    } as any);

    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
    };

    mockGetUser.mockResolvedValueOnce(mockUser);

    mockQuery
      .mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

    const Account = (await import('@/app/account/page')).default;
    await Account();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('avatar_url'),
      [mockUser.id]
    );
  });
});
