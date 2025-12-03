import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './zerodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '7d'; // 7 days

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
}

/**
 * Validate email format using regex
 */
function isValidEmail(email: string): boolean {
  // Basic email regex that prevents consecutive dots and invalid formats
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Check for consecutive dots
  if (email.includes('..')) {
    return false;
  }

  // Check basic format
  if (!emailRegex.test(email)) {
    return false;
  }

  return true;
}

/**
 * Sign up a new user with email and password
 * @param email - User's email address
 * @param password - User's password (will be hashed)
 * @param fullName - Optional full name
 * @returns AuthResponse with access token and user data
 * @throws Error if validation fails or user already exists
 */
export async function signUp(
  email: string,
  password: string,
  fullName?: string
): Promise<AuthResponse> {
  // Validate email
  if (!isValidEmail(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password (minimum 6 characters)
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  // Check if user exists
  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0) {
    throw new Error('User already exists');
  }

  // Hash password with bcrypt (10 rounds)
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const result = await query(
    `INSERT INTO users (email, full_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, full_name`,
    [email, fullName, passwordHash]
  );

  const user = result.rows[0];

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
    },
  };
}

/**
 * Sign in an existing user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns AuthResponse with access token and user data
 * @throws Error if credentials are invalid
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  // Validate inputs
  if (!email || !password) {
    throw new Error('Invalid credentials');
  }

  const result = await query(
    'SELECT id, email, full_name, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];

  // Verify password using bcrypt
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new Error('Invalid credentials');
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
    },
  };
}

/**
 * Get user data from access token
 * @param accessToken - JWT access token
 * @returns User object with id, email, and full_name
 * @throws Error if token is invalid or user not found
 */
export async function getUser(accessToken: string): Promise<User> {
  if (!accessToken) {
    throw new Error('Invalid token');
  }

  try {
    // Verify and decode JWT token
    const decoded = jwt.verify(accessToken, JWT_SECRET) as {
      userId: string;
      email: string;
    };

    // Fetch user from database
    const result = await query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  } catch (error) {
    // Handle JWT errors (expired, malformed, etc.)
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Sign out a user (invalidates the token on client side)
 * Note: JWT tokens are stateless, so actual invalidation happens client-side
 * by removing the token from storage/cookies
 * @param accessToken - JWT access token (validated but not stored)
 * @returns Success response
 */
export async function signOut(accessToken: string): Promise<{ success: boolean }> {
  // Validate token before allowing sign out
  if (accessToken) {
    try {
      jwt.verify(accessToken, JWT_SECRET);
    } catch (error) {
      // Token is invalid, but we still return success
      // as the goal is to sign out
    }
  }

  // In a JWT-based system, sign out is primarily handled client-side
  // by removing the token from storage
  // For enhanced security, you could implement a token blacklist here
  return { success: true };
}

/**
 * Refresh an access token (generates a new token with extended expiry)
 * @param accessToken - Current JWT access token
 * @returns AuthResponse with new access token
 * @throws Error if token is invalid
 */
export async function refreshToken(accessToken: string): Promise<AuthResponse> {
  if (!accessToken) {
    throw new Error('Invalid token');
  }

  try {
    // Verify current token (allow expired tokens for refresh)
    const decoded = jwt.verify(accessToken, JWT_SECRET, {
      ignoreExpiration: true,
    }) as {
      userId: string;
      email: string;
    };

    // Fetch user to ensure they still exist
    const result = await query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // Generate new JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 60 * 60,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify if a JWT token is valid
 * @param accessToken - JWT access token to verify
 * @returns True if token is valid, false otherwise
 */
export function verifyToken(accessToken: string): boolean {
  if (!accessToken) {
    return false;
  }

  try {
    jwt.verify(accessToken, JWT_SECRET);
    return true;
  } catch (error) {
    return false;
  }
}
