/**
 * Tests for helper utilities
 */

import {
  getURL,
  postData,
  toDateTime,
  calculateTrialEndUnixTimestamp,
  getStatusRedirect,
  getErrorRedirect,
} from '../helpers';

describe('Helper Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getURL', () => {
    it('should return localhost URL when no env vars are set', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
      const url = getURL();
      expect(url).toBe('http://localhost:3000');
    });

    it('should use NEXT_PUBLIC_SITE_URL when set', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      const url = getURL();
      expect(url).toBe('https://example.com');
    });

    it('should use NEXT_PUBLIC_VERCEL_URL when SITE_URL is not set', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_VERCEL_URL = 'example.vercel.app';
      const url = getURL();
      expect(url).toBe('https://example.vercel.app');
    });

    it('should append path correctly', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      const url = getURL('api/test');
      expect(url).toBe('https://example.com/api/test');
    });

    it('should handle trailing slashes in URL', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com///';
      const url = getURL();
      expect(url).toBe('https://example.com');
    });

    it('should handle leading slashes in path', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      const url = getURL('///api/test');
      expect(url).toBe('https://example.com/api/test');
    });

    it('should add https:// if not present', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'example.com';
      const url = getURL();
      expect(url).toBe('https://example.com');
    });

    it('should not modify localhost URLs', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
      const url = getURL();
      expect(url).toBe('http://localhost:3000');
    });

    it('should handle empty string path', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
      const url = getURL('');
      expect(url).toBe('https://example.com');
    });
  });

  describe('postData', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should make POST request with correct headers', async () => {
      const mockResponse = { success: true };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await postData({
        url: '/api/test',
        data: { price: {} as any },
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: expect.any(Headers),
        credentials: 'same-origin',
        body: expect.any(String),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should send data as JSON', async () => {
      const mockPrice = { id: 'price_123', unit_amount: 1000 };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      await postData({
        url: '/api/test',
        data: { price: mockPrice as any },
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const sentData = JSON.parse(callArgs.body);
      expect(sentData).toEqual({ price: mockPrice });
    });

    it('should handle undefined data', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      await postData({ url: '/api/test' });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(callArgs.body).toBe('{}');
    });
  });

  describe('toDateTime', () => {
    it('should convert Unix timestamp to Date', () => {
      const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
      const date = toDateTime(timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(timestamp * 1000);
    });

    it('should handle zero timestamp', () => {
      const date = toDateTime(0);
      expect(date.getTime()).toBe(0);
    });

    it('should handle negative timestamp', () => {
      const timestamp = -86400; // One day before epoch
      const date = toDateTime(timestamp);
      expect(date.getTime()).toBe(timestamp * 1000);
    });

    it('should handle large timestamp', () => {
      const timestamp = 2147483647; // Max 32-bit signed integer
      const date = toDateTime(timestamp);
      expect(date.getTime()).toBe(timestamp * 1000);
    });
  });

  describe('calculateTrialEndUnixTimestamp', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return undefined for null', () => {
      const result = calculateTrialEndUnixTimestamp(null);
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      const result = calculateTrialEndUnixTimestamp(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined for 0 days', () => {
      const result = calculateTrialEndUnixTimestamp(0);
      expect(result).toBeUndefined();
    });

    it('should return undefined for 1 day', () => {
      const result = calculateTrialEndUnixTimestamp(1);
      expect(result).toBeUndefined();
    });

    it('should calculate timestamp for 7 days trial', () => {
      const result = calculateTrialEndUnixTimestamp(7);
      expect(result).toBeDefined();
      expect(typeof result).toBe('number');

      // Should be 8 days from now (7 + 1)
      const expectedDate = new Date('2024-01-09T00:00:00.000Z');
      expect(result).toBe(Math.floor(expectedDate.getTime() / 1000));
    });

    it('should calculate timestamp for 14 days trial', () => {
      const result = calculateTrialEndUnixTimestamp(14);
      expect(result).toBeDefined();

      // Should be 15 days from now (14 + 1)
      const expectedDate = new Date('2024-01-16T00:00:00.000Z');
      expect(result).toBe(Math.floor(expectedDate.getTime() / 1000));
    });

    it('should calculate timestamp for 30 days trial', () => {
      const result = calculateTrialEndUnixTimestamp(30);
      expect(result).toBeDefined();

      // Should be 31 days from now (30 + 1)
      const expectedDate = new Date('2024-02-01T00:00:00.000Z');
      expect(result).toBe(Math.floor(expectedDate.getTime() / 1000));
    });

    it('should return Unix timestamp in seconds', () => {
      const result = calculateTrialEndUnixTimestamp(7);
      expect(result).toBeDefined();
      // Unix timestamps are typically 10 digits for dates around 2024
      expect(result!.toString().length).toBe(10);
    });
  });

  describe('getStatusRedirect', () => {
    it('should create status redirect URL', () => {
      const url = getStatusRedirect('/dashboard', 'Success', 'Operation completed');
      expect(url).toBe('/dashboard?status=Success&status_description=Operation%20completed');
    });

    it('should handle special characters in status name', () => {
      const url = getStatusRedirect('/dashboard', 'Success & Complete');
      expect(url).toContain('status=Success%20%26%20Complete');
    });

    it('should work without description', () => {
      const url = getStatusRedirect('/dashboard', 'Success');
      expect(url).toBe('/dashboard?status=Success');
    });

    it('should handle disable button flag', () => {
      const url = getStatusRedirect('/dashboard', 'Success', 'Done', true);
      expect(url).toContain('disable_button=true');
    });

    it('should handle arbitrary params', () => {
      const url = getStatusRedirect('/dashboard', 'Success', '', false, 'foo=bar&baz=qux');
      expect(url).toContain('foo=bar&baz=qux');
    });

    it('should handle empty description', () => {
      const url = getStatusRedirect('/dashboard', 'Success', '');
      expect(url).toBe('/dashboard?status=Success');
    });

    it('should combine all parameters', () => {
      const url = getStatusRedirect(
        '/dashboard',
        'Success',
        'All done',
        true,
        'step=complete'
      );
      expect(url).toContain('status=Success');
      expect(url).toContain('status_description=All%20done');
      expect(url).toContain('disable_button=true');
      expect(url).toContain('step=complete');
    });
  });

  describe('getErrorRedirect', () => {
    it('should create error redirect URL', () => {
      const url = getErrorRedirect('/signin', 'AuthError', 'Invalid credentials');
      expect(url).toBe('/signin?error=AuthError&error_description=Invalid%20credentials');
    });

    it('should handle special characters in error name', () => {
      const url = getErrorRedirect('/signin', 'Auth Error: Failed');
      expect(url).toContain('error=Auth%20Error%3A%20Failed');
    });

    it('should work without description', () => {
      const url = getErrorRedirect('/signin', 'AuthError');
      expect(url).toBe('/signin?error=AuthError');
    });

    it('should handle disable button flag', () => {
      const url = getErrorRedirect('/signin', 'AuthError', 'Failed', true);
      expect(url).toContain('disable_button=true');
    });

    it('should handle arbitrary params', () => {
      const url = getErrorRedirect('/signin', 'AuthError', '', false, 'retry=1');
      expect(url).toContain('retry=1');
    });

    it('should encode error descriptions properly', () => {
      const url = getErrorRedirect('/signin', 'Error', 'Connection failed & timeout');
      expect(url).toContain('Connection%20failed%20%26%20timeout');
    });

    it('should combine all parameters', () => {
      const url = getErrorRedirect(
        '/signin',
        'AuthError',
        'Invalid token',
        true,
        'attempt=3'
      );
      expect(url).toContain('error=AuthError');
      expect(url).toContain('error_description=Invalid%20token');
      expect(url).toContain('disable_button=true');
      expect(url).toContain('attempt=3');
    });
  });
});
