-- ============================================================================
-- ZeroDB PostgreSQL Schema for Next.js Subscription Payments
-- ============================================================================
-- This schema is designed for ZeroDB PostgreSQL and removes all Supabase
-- auth.users references, replacing them with a standalone users table.
-- ============================================================================

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Pricing type: one-time or recurring subscription
DO $$ BEGIN
  CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Subscription billing interval
DO $$ BEGIN
  CREATE TYPE pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Subscription status lifecycle
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'trialing',
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'unpaid',
    'paused'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TRIGGER FUNCTION: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Core user table with authentication fields (email, password_hash)
-- No longer references auth.users - this is a standalone table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  -- Primary key: UUID generated automatically
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication fields
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,

  -- Profile fields
  full_name TEXT,
  avatar_url TEXT,

  -- Billing information (stored as JSON)
  billing_address JSONB,
  payment_method JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Trigger to auto-update updated_at on users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: customers
-- ============================================================================
-- Maps user IDs to Stripe customer IDs
-- One-to-one relationship with users
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  -- Primary key: UUID generated automatically
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to users table
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Stripe customer ID (must be unique)
  stripe_customer_id TEXT UNIQUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Ensure one customer per user
  CONSTRAINT unique_user_customer UNIQUE (user_id)
);

-- Indexes for customers table
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_stripe_id ON customers(stripe_customer_id);

-- Trigger to auto-update updated_at on customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: products
-- ============================================================================
-- Products synced from Stripe
-- Represents items available for purchase
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  -- Primary key: Stripe product ID (e.g., prod_1234)
  id TEXT PRIMARY KEY,

  -- Product status
  active BOOLEAN DEFAULT TRUE NOT NULL,

  -- Product details
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,

  -- Additional metadata from Stripe
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT product_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Trigger to auto-update updated_at on products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: prices
-- ============================================================================
-- Pricing information for products
-- Synced from Stripe
-- ============================================================================

CREATE TABLE IF NOT EXISTS prices (
  -- Primary key: Stripe price ID (e.g., price_1234)
  id TEXT PRIMARY KEY,

  -- Foreign key to products table
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Price status
  active BOOLEAN DEFAULT TRUE NOT NULL,

  -- Price details
  description TEXT,
  unit_amount BIGINT CHECK (unit_amount >= 0),
  currency TEXT NOT NULL CHECK (LENGTH(currency) = 3),

  -- Pricing type and interval
  type pricing_type NOT NULL,
  interval pricing_plan_interval,
  interval_count INTEGER CHECK (interval_count > 0),

  -- Trial period
  trial_period_days INTEGER CHECK (trial_period_days >= 0),

  -- Additional metadata from Stripe
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT recurring_requires_interval CHECK (
    type = 'one_time' OR (interval IS NOT NULL AND interval_count IS NOT NULL)
  )
);

-- Indexes for prices table
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_active ON prices(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_prices_type ON prices(type);

-- Trigger to auto-update updated_at on prices
DROP TRIGGER IF EXISTS update_prices_updated_at ON prices;
CREATE TRIGGER update_prices_updated_at
  BEFORE UPDATE ON prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: subscriptions
-- ============================================================================
-- Active subscriptions for users
-- Synced from Stripe
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  -- Primary key: Stripe subscription ID (e.g., sub_1234)
  id TEXT PRIMARY KEY,

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_id TEXT REFERENCES prices(id),

  -- Subscription status
  status subscription_status NOT NULL,

  -- Subscription details
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL,

  -- Additional metadata from Stripe
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps: Subscription lifecycle
  created TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,

  -- Internal timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_period CHECK (
    current_period_start IS NULL OR
    current_period_end IS NULL OR
    current_period_end > current_period_start
  ),
  CONSTRAINT valid_trial CHECK (
    trial_start IS NULL OR
    trial_end IS NULL OR
    trial_end > trial_start
  )
);

-- Indexes for subscriptions table
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_price_id ON subscriptions(price_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- Trigger to auto-update updated_at on subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS: Table and Column Documentation
-- ============================================================================

COMMENT ON TABLE users IS 'Core user accounts with authentication and profile data';
COMMENT ON COLUMN users.email IS 'User email address (unique, used for login)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.billing_address IS 'Billing address stored as JSON';
COMMENT ON COLUMN users.payment_method IS 'Default payment method stored as JSON';

COMMENT ON TABLE customers IS 'Mapping between users and Stripe customer IDs';
COMMENT ON COLUMN customers.stripe_customer_id IS 'Unique Stripe customer identifier';

COMMENT ON TABLE products IS 'Products available for purchase (synced from Stripe)';
COMMENT ON COLUMN products.active IS 'Whether product is available for purchase';
COMMENT ON COLUMN products.metadata IS 'Additional product data from Stripe';

COMMENT ON TABLE prices IS 'Pricing options for products (synced from Stripe)';
COMMENT ON COLUMN prices.unit_amount IS 'Price in smallest currency unit (e.g., cents)';
COMMENT ON COLUMN prices.interval IS 'Billing frequency for recurring prices';
COMMENT ON COLUMN prices.interval_count IS 'Number of intervals between billings';

COMMENT ON TABLE subscriptions IS 'Active user subscriptions (synced from Stripe)';
COMMENT ON COLUMN subscriptions.status IS 'Current subscription status';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'Whether subscription cancels at period end';
COMMENT ON COLUMN subscriptions.quantity IS 'Number of units (e.g., seats)';

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  description TEXT
);

-- Record current schema version
INSERT INTO schema_version (version, description)
VALUES (1, 'Initial ZeroDB schema with users, customers, products, prices, subscriptions')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
