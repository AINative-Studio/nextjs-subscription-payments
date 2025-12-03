import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  signUp,
  signIn,
  getUser,
  signOut,
  refreshToken,
  verifyToken,
} from '../auth';
import * as zerodb from '../zerodb';

// Mock the zerodb module
jest.mock('../zerodb');

const mockQuery = zerodb.query as jest.MockedFunction<typeof zerodb.query>;

describe('Authentication System', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should successfully register a new user', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const fullName = 'Test User';

      // Mock database responses
      mockQuery
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as any) // Check if user exists
        .mockResolvedValueOnce({
          rows: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email,
              full_name: fullName,
            },
          ],
          rowCount: 1,
        } as any); // Insert user

      const result = await signUp(email, password, fullName);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result).toHaveProperty('expires_in', 604800); // 7 days
      expect(result.user).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email,
        full_name: fullName,
      });

      // Verify token is valid
      const decoded = jwt.verify(result.access_token, JWT_SECRET) as any;
      expect(decoded.email).toBe(email);
      expect(decoded.userId).toBe('123e4567-e89b-12d3-a456-426614174000');

      // Verify password was hashed
      expect(mockQuery).toHaveBeenCalledTimes(2);
      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[0]).toContain('INSERT INTO users');
      expect(insertCall[1]?.[2]).not.toBe(password); // Password should be hashed
    });

    it('should fail with invalid email format', async () => {
      await expect(signUp('invalid-email', 'password123')).rejects.toThrow(
        'Invalid email format'
      );

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should fail with short password', async () => {
      await expect(signUp('test@example.com', '12345')).rejects.toThrow(
        'Password must be at least 6 characters long'
      );

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should fail when user already exists', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-user-id' }],
        rowCount: 1,
      } as any);

      await expect(
        signUp('existing@example.com', 'password123')
      ).rejects.toThrow('User already exists');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should hash password with bcrypt', async () => {
      const password = 'testpassword123';

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'user-id', email: 'test@example.com', full_name: 'Test' }],
          rowCount: 1,
        } as any);

      await signUp('test@example.com', password, 'Test');

      const insertCall = mockQuery.mock.calls[1];
      const hashedPassword = insertCall[1]?.[2] as string;

      // Verify password was hashed
      expect(hashedPassword).not.toBe(password);
      expect(await bcrypt.compare(password, hashedPassword)).toBe(true);
    });
  });

  describe('signIn', () => {
    it('should successfully sign in with correct credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-id',
            email,
            full_name: 'Test User',
            password_hash: hashedPassword,
          },
        ],
        rowCount: 1,
      } as any);

      const result = await signIn(email, password);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result).toHaveProperty('expires_in', 604800);
      expect(result.user).toEqual({
        id: 'user-id',
        email,
        full_name: 'Test User',
      });

      // Verify token
      const decoded = jwt.verify(result.access_token, JWT_SECRET) as any;
      expect(decoded.email).toBe(email);
    });

    it('should fail with non-existent user', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      await expect(
        signIn('nonexistent@example.com', 'password123')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should fail with incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-id',
            email: 'test@example.com',
            full_name: 'Test User',
            password_hash: hashedPassword,
          },
        ],
        rowCount: 1,
      } as any);

      await expect(
        signIn('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should fail with empty credentials', async () => {
      await expect(signIn('', 'password')).rejects.toThrow('Invalid credentials');
      await expect(signIn('test@example.com', '')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('getUser', () => {
    it('should retrieve user with valid token', async () => {
      const userId = 'user-id';
      const email = 'test@example.com';
      const token = jwt.sign({ userId, email }, JWT_SECRET);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: userId,
            email,
            full_name: 'Test User',
          },
        ],
        rowCount: 1,
      } as any);

      const user = await getUser(token);

      expect(user).toEqual({
        id: userId,
        email,
        full_name: 'Test User',
      });
    });

    it('should fail with invalid token', async () => {
      await expect(getUser('invalid-token')).rejects.toThrow('Invalid token');
    });

    it('should fail with empty token', async () => {
      await expect(getUser('')).rejects.toThrow('Invalid token');
    });

    it('should fail with expired token', async () => {
      const token = jwt.sign(
        { userId: 'user-id', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '-1s' } // Already expired
      );

      await expect(getUser(token)).rejects.toThrow('Token expired');
    });

    it('should fail when user not found in database', async () => {
      const token = jwt.sign(
        { userId: 'non-existent-id', email: 'test@example.com' },
        JWT_SECRET
      );

      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      await expect(getUser(token)).rejects.toThrow('User not found');
    });
  });

  describe('signOut', () => {
    it('should successfully sign out with valid token', async () => {
      const token = jwt.sign(
        { userId: 'user-id', email: 'test@example.com' },
        JWT_SECRET
      );

      const result = await signOut(token);

      expect(result).toEqual({ success: true });
    });

    it('should return success even with invalid token', async () => {
      const result = await signOut('invalid-token');

      expect(result).toEqual({ success: true });
    });

    it('should return success with empty token', async () => {
      const result = await signOut('');

      expect(result).toEqual({ success: true });
    });
  });

  describe('refreshToken', () => {
    it('should generate new token from valid token', async () => {
      const userId = 'user-id';
      const email = 'test@example.com';
      const oldToken = jwt.sign({ userId, email }, JWT_SECRET);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: userId,
            email,
            full_name: 'Test User',
          },
        ],
        rowCount: 1,
      } as any);

      const result = await refreshToken(oldToken);

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).not.toBe(oldToken);
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result.user).toEqual({
        id: userId,
        email,
        full_name: 'Test User',
      });

      // Verify new token is valid
      const decoded = jwt.verify(result.access_token, JWT_SECRET) as any;
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
    });

    it('should refresh expired token', async () => {
      const userId = 'user-id';
      const email = 'test@example.com';
      const expiredToken = jwt.sign({ userId, email }, JWT_SECRET, {
        expiresIn: '-1s',
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: userId,
            email,
            full_name: 'Test User',
          },
        ],
        rowCount: 1,
      } as any);

      const result = await refreshToken(expiredToken);

      expect(result).toHaveProperty('access_token');
      expect(result.user.id).toBe(userId);
    });

    it('should fail with invalid token', async () => {
      await expect(refreshToken('invalid-token')).rejects.toThrow('Invalid token');
    });

    it('should fail with empty token', async () => {
      await expect(refreshToken('')).rejects.toThrow('Invalid token');
    });

    it('should fail when user not found', async () => {
      const token = jwt.sign(
        { userId: 'non-existent-id', email: 'test@example.com' },
        JWT_SECRET
      );

      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      await expect(refreshToken(token)).rejects.toThrow('User not found');
    });
  });

  describe('verifyToken', () => {
    it('should return true for valid token', () => {
      const token = jwt.sign(
        { userId: 'user-id', email: 'test@example.com' },
        JWT_SECRET
      );

      expect(verifyToken(token)).toBe(true);
    });

    it('should return false for invalid token', () => {
      expect(verifyToken('invalid-token')).toBe(false);
    });

    it('should return false for empty token', () => {
      expect(verifyToken('')).toBe(false);
    });

    it('should return false for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-id', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );

      expect(verifyToken(expiredToken)).toBe(false);
    });
  });

  describe('Password Security', () => {
    it('should never store plaintext passwords', async () => {
      const password = 'mySecurePassword123';

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'user-id', email: 'test@example.com', full_name: 'Test' }],
          rowCount: 1,
        } as any);

      await signUp('test@example.com', password, 'Test');

      const insertCall = mockQuery.mock.calls[1];
      const storedPassword = insertCall[1]?.[2] as string;

      // Password should be hashed, not plaintext
      expect(storedPassword).not.toBe(password);
      expect(storedPassword).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });

    it('should use bcrypt for password hashing', async () => {
      const password = 'testPassword456';

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'user-id', email: 'test@example.com', full_name: 'Test' }],
          rowCount: 1,
        } as any);

      await signUp('test@example.com', password);

      const insertCall = mockQuery.mock.calls[1];
      const hashedPassword = insertCall[1]?.[2] as string;

      // Verify bcrypt hash can validate the password
      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate valid JWT tokens', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: 'user-id-123', email: 'test@example.com', full_name: 'Test' },
          ],
          rowCount: 1,
        } as any);

      const result = await signUp('test@example.com', 'password123');

      const decoded = jwt.verify(result.access_token, JWT_SECRET) as any;

      expect(decoded).toHaveProperty('userId', 'user-id-123');
      expect(decoded).toHaveProperty('email', 'test@example.com');
      expect(decoded).toHaveProperty('iat'); // issued at
      expect(decoded).toHaveProperty('exp'); // expiration
    });

    it('should set correct token expiration', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'user-id', email: 'test@example.com', full_name: 'Test' }],
          rowCount: 1,
        } as any);

      const result = await signUp('test@example.com', 'password123');

      const decoded = jwt.verify(result.access_token, JWT_SECRET) as any;

      const expectedExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const actualExpiry = decoded.exp;

      // Allow 5 second tolerance for test execution time
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(5);
    });
  });

  describe('Email Validation', () => {
    const invalidEmails = [
      'invalid',
      'invalid@',
      '@invalid.com',
      'invalid@.com',
      'invalid..email@example.com',
      'invalid @example.com',
      'invalid@example',
    ];

    invalidEmails.forEach((email) => {
      it(`should reject invalid email: ${email}`, async () => {
        await expect(signUp(email, 'password123')).rejects.toThrow(
          'Invalid email format'
        );
      });
    });

    const validEmails = [
      'test@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user_name@example-domain.com',
    ];

    validEmails.forEach((email) => {
      it(`should accept valid email: ${email}`, async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
          .mockResolvedValueOnce({
            rows: [{ id: 'user-id', email, full_name: 'Test' }],
            rowCount: 1,
          } as any);

        const result = await signUp(email, 'password123');
        expect(result.user.email).toBe(email);
      });
    });
  });
});
