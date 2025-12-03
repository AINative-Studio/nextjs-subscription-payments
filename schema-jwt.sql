-- Updated schema for JWT authentication
-- This replaces the Supabase auth.users reference with a standalone users table

-- Drop existing foreign key constraints first
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

/**
* USERS
* Note: This table contains user data with JWT authentication support.
*/
CREATE TABLE users (
  -- Primary key as UUID
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- User email (unique, required)
  email TEXT NOT NULL UNIQUE,
  -- User's full name
  full_name TEXT,
  -- Hashed password (bcrypt)
  password_hash TEXT NOT NULL,
  -- Avatar URL
  avatar_url TEXT,
  -- The customer's billing address, stored in JSON format.
  billing_address JSONB,
  -- Stores your customer's payment instruments.
  payment_method JSONB,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Enable row level security (can be configured based on your needs)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

/**
* CUSTOMERS
* Note: this is a private table that contains a mapping of user IDs to Stripe customer IDs.
*/
CREATE TABLE customers (
  -- UUID from users table
  id UUID REFERENCES users(id) NOT NULL PRIMARY KEY,
  -- The user's customer ID in Stripe. User must not be able to update this.
  stripe_customer_id TEXT
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

/**
* PRODUCTS
* Note: products are created and managed in Stripe and synced to our DB via Stripe webhooks.
*/
CREATE TABLE products (
  -- Product ID from Stripe, e.g. prod_1234.
  id TEXT PRIMARY KEY,
  -- Whether the product is currently available for purchase.
  active BOOLEAN,
  -- The product's name, meant to be displayable to the customer.
  name TEXT,
  -- The product's description, meant to be displayable to the customer.
  description TEXT,
  -- A URL of the product image in Stripe, meant to be displayable to the customer.
  image TEXT,
  -- Set of key-value pairs, used to store additional information about the object in a structured format.
  metadata JSONB
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON products FOR SELECT USING (true);

/**
* PRICES
* Note: prices are created and managed in Stripe and synced to our DB via Stripe webhooks.
*/
CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
CREATE TYPE pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');

CREATE TABLE prices (
  -- Price ID from Stripe, e.g. price_1234.
  id TEXT PRIMARY KEY,
  -- The ID of the product that this price belongs to.
  product_id TEXT REFERENCES products,
  -- Whether the price can be used for new purchases.
  active BOOLEAN,
  -- A brief description of the price.
  description TEXT,
  -- The unit amount as a positive integer in the smallest currency unit.
  unit_amount BIGINT,
  -- Three-letter ISO currency code, in lowercase.
  currency TEXT CHECK (char_length(currency) = 3),
  -- One of `one_time` or `recurring` depending on whether the price is for a one-time purchase or a recurring purchase.
  type pricing_type,
  -- The frequency at which a subscription is billed.
  interval pricing_plan_interval,
  -- The number of intervals between subscription billings.
  interval_count INTEGER,
  -- Default number of trial days.
  trial_period_days INTEGER,
  -- Set of key-value pairs.
  metadata JSONB
);

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON prices FOR SELECT USING (true);

/**
* SUBSCRIPTIONS
* Note: subscriptions are created and managed in Stripe and synced to our DB via Stripe webhooks.
*/
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');

CREATE TABLE subscriptions (
  -- Subscription ID from Stripe, e.g. sub_1234.
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  -- The status of the subscription object.
  status subscription_status,
  -- Set of key-value pairs.
  metadata JSONB,
  -- ID of the price that created this subscription.
  price_id TEXT REFERENCES prices,
  -- Quantity multiplied by the unit amount.
  quantity INTEGER,
  -- If true the subscription has been canceled by the user.
  cancel_at_period_end BOOLEAN,
  -- Time at which the subscription was created.
  created TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Start of the current period.
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- End of the current period.
  current_period_end TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- If the subscription has ended.
  ended_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  -- A date in the future at which the subscription will automatically get canceled.
  cancel_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  -- If the subscription has been canceled.
  canceled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  -- If the subscription has a trial, the beginning of that trial.
  trial_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  -- If the subscription has a trial, the end of that trial.
  trial_end TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
