# Next.js Subscription Payments - ZeroDB Showcase

**🎯 See how easy it is to replace Supabase with ZeroDB in a real-world SaaS application!**

This is a production-ready Next.js 14 template demonstrating Stripe subscription payments with **ZeroDB PostgreSQL** instead of Supabase. Perfect for developers who want a simpler, more powerful database solution.

## What You'll Learn

- ✅ Direct PostgreSQL connection with ZeroDB (no proprietary SDKs!)
- ✅ Stripe webhook integration for subscriptions
- ✅ User & subscription data management
- ✅ Production-ready database patterns
- ✅ Simple JWT-based authentication

## Why ZeroDB over Supabase?

**Before (Supabase):**
```bash
# Complex setup with 10+ environment variables
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# Plus Stripe vars
```

**After (ZeroDB):**
```bash
# Clean, simple PostgreSQL connection
ZERODB_CONNECTION_STRING=postgresql://...
# Same Stripe vars (no changes!)
```

**Benefits:**
- 📦 **40% less code** - Use standard `pg` library instead of proprietary SDK
- ⚡ **15 min setup** vs 45 minutes with Supabase
- 🧠 **Simple** Mental model - just PostgreSQL, no vendor lock-in
- 💰 **Cost-effective** - $29/month includes dedicated PostgreSQL + vector search + file storage

---

## Quick Start (10 Minutes Total!)

### 1. Clone & Install (2 minutes)

```bash
git clone https://github.com/AINative-Studio/nextjs-subscription-payments
cd nextjs-subscription-payments
npm install
```

### 2. Set Up ZeroDB Project (5 minutes)

```bash
# Visit https://ainative.studio/dashboard
# Create new project → Enable PostgreSQL
# Copy your connection string
```

### 3. Configure Environment (2 minutes)

```bash
cp .env.example .env.local

# Edit .env.local:
ZERODB_CONNECTION_STRING="your-connection-string-here"

# Stripe keys (test mode)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # After creating webhook
```

### 4. Initialize Database (1 minute)

```bash
npm run db:setup
# Creates all tables, indexes, and sample products
```

### 5. Run the App (30 seconds)

```bash
npm run dev
# Open http://localhost:3000
# See pricing page, test checkout flow!
```

**Total Time: ~10 minutes from zero to working SaaS app** 🎉

---

## Features

- 🔐 **Simple Authentication** - JWT-based auth (no complex OAuth setup required)
- 💳 **Stripe Integration** - Secure checkout & subscription management
- 📊 **Subscription Dashboard** - View active subscriptions & billing
- 🪝 **Webhook Handling** - Auto-sync Stripe events to database
- 🗄️ **PostgreSQL Database** - Powered by ZeroDB (no vendor lock-in)
- 🎨 **Modern UI** - Built with Next.js 14 App Router + Tailwind CSS

## What You'll Build

A complete SaaS subscription platform with:
- **Pricing page** with tiered plans (Free, Pro, Enterprise)
- **Stripe Checkout** for secure payments
- **User dashboard** showing active subscription
- **Webhook handling** for subscription events
- **PostgreSQL database** powered by ZeroDB

---

## Project Structure

```
nextjs-subscription-payments/
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── stripe/         # Stripe webhook handler
│   ├── account/                # User account pages
│   ├── pricing/                # Pricing page
│   └── signin/                 # Authentication
├── components/
│   ├── ui/                     # Shadcn UI components
│   └── pricing/                # Pricing table components
├── lib/
│   ├── zerodb.ts               # ZeroDB connection utility
│   └── auth.ts                 # JWT authentication
├── database/
│   └── schema.sql              # PostgreSQL schema
└── .env.example                # Environment variables template
```

---

## Database Schema

### Tables
- **users** - User profiles (email, name, billing info)
- **customers** - Maps users to Stripe customer IDs
- **products** - Stripe products (synced via webhooks)
- **prices** - Pricing plans (synced via webhooks)
- **subscriptions** - User subscriptions (synced via webhooks)

### Custom Types
```sql
CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
CREATE TYPE pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', ...);
```

---

## Stripe Setup

### 1. Create Products in Stripe Dashboard

Visit [Stripe Products](https://dashboard.stripe.com/test/products) and create:

- **Product 1**: Hobby ($10/month or $100/year)
- **Product 2**: Freelancer ($20/month or $200/year)
- **Product 3**: Enterprise (Custom pricing)

### 2. Create Webhook

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add Endpoint"
3. Enter URL: `https://your-domain.com/api/webhooks/stripe`
4. Select these events:
   - `product.created`
   - `product.updated`
   - `price.created`
   - `price.updated`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
5. Copy the **Signing Secret** and add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 3. Test Locally with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test with fixtures
stripe fixtures fixtures/stripe-fixtures.json
```

---

## Deployment

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAINative-Studio%2Fnextjs-subscription-payments)

1. Click the button above
2. Add environment variables:
   - `ZERODB_CONNECTION_STRING`
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
3. Deploy!

### Update Stripe Webhook URL

After deployment, update your Stripe webhook endpoint URL to point to your production domain:
```
https://your-domain.vercel.app/api/webhooks/stripe
```

---

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# ZeroDB
ZERODB_CONNECTION_STRING=postgresql://user:pass@host:5432/dbname

# Stripe (get from https://dashboard.stripe.com/apikeys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Next.js
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Setup database (run once)
npm run db:setup

# Build for production
npm run build

# Start production server
npm start
```

---

## Comparison: Supabase vs ZeroDB

| Feature | Supabase | ZeroDB |
|---------|----------|---------|
| **Setup Time** | 45 minutes | 15 minutes |
| **Dependencies** | 3+ packages | 1 package (`pg`) |
| **Code Complexity** | High (RLS, Auth, SSR) | Low (Standard SQL) |
| **Vendor Lock-in** | Yes (proprietary SDK) | No (PostgreSQL) |
| **Auth Complexity** | Complex OAuth setup | Simple JWT |
| **Database Access** | Through SDK only | Direct PostgreSQL |
| **Cost (Pro Tier)** | $25/month | $29/month (+vector search, file storage) |
| **Learning Curve** | Steep | Minimal (if you know SQL) |

---

## Migration from Supabase

Already using Supabase? See our [Migration Guide](https://github.com/AINative-Studio/core/blob/main/AINative-website/docs/migrations/nextjs-subscription-payments-migration.md) for step-by-step instructions to migrate your existing app to ZeroDB.

---

## Support & Resources

- 📖 **ZeroDB Docs**: https://zerodb.ainative.studio
- 🔑 **API Reference**: https://api.ainative.studio/docs
- 💬 **Discord Community**: https://discord.com/invite/paipalooza
- 🐛 **Issues**: https://github.com/AINative-Studio/nextjs-subscription-payments/issues
- 📧 **Email**: support@ainative.studio

---

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with 💚 in Santa Cruz, California**

---

## Acknowledgments

This project is inspired by Vercel's [nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments) template, adapted to showcase ZeroDB as a simpler, more powerful alternative to Supabase.
