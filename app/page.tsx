import Pricing from '@/components/ui/Pricing/Pricing';
import { query } from '@/lib/zerodb';
import { getUser } from '@/lib/auth';
import { cookies } from 'next/headers';

export default async function PricingPage() {
  // Get user from JWT token (optional - user may not be logged in)
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;

  let user = null;
  if (token) {
    try {
      user = await getUser(token);
    } catch (error) {
      // User token invalid or expired, continue as guest
      console.warn('Invalid or expired token:', error);
    }
  }

  // Get products with prices using JSON aggregation
  const productsResult = await query(`
    SELECT
      p.id,
      p.active,
      p.name,
      p.description,
      p.image,
      p.metadata,
      COALESCE(
        json_agg(
          json_build_object(
            'id', pr.id,
            'product_id', pr.product_id,
            'active', pr.active,
            'description', pr.description,
            'unit_amount', pr.unit_amount,
            'currency', pr.currency,
            'type', pr.type,
            'interval', pr.interval,
            'interval_count', pr.interval_count,
            'trial_period_days', pr.trial_period_days,
            'metadata', pr.metadata
          ) ORDER BY pr.unit_amount
        ) FILTER (WHERE pr.id IS NOT NULL),
        '[]'::json
      ) as prices
    FROM products p
    LEFT JOIN prices pr ON pr.product_id = p.id AND pr.active = true
    WHERE p.active = true
    GROUP BY p.id, p.active, p.name, p.description, p.image, p.metadata
    ORDER BY CAST(p.metadata->>'index' AS INTEGER) NULLS LAST
  `);

  const products = productsResult.rows;

  // Get subscription if user is logged in
  let subscription = null;
  if (user) {
    const subscriptionResult = await query(`
      SELECT
        s.id,
        s.user_id,
        s.status,
        s.price_id,
        s.quantity,
        s.cancel_at_period_end,
        s.cancel_at,
        s.canceled_at,
        s.current_period_start,
        s.current_period_end,
        s.created,
        s.ended_at,
        s.trial_start,
        s.trial_end,
        s.metadata as subscription_metadata,
        json_build_object(
          'id', pr.id,
          'product_id', pr.product_id,
          'active', pr.active,
          'description', pr.description,
          'unit_amount', pr.unit_amount,
          'currency', pr.currency,
          'type', pr.type,
          'interval', pr.interval,
          'interval_count', pr.interval_count,
          'trial_period_days', pr.trial_period_days,
          'metadata', pr.metadata,
          'products', json_build_object(
            'id', p.id,
            'active', p.active,
            'name', p.name,
            'description', p.description,
            'image', p.image,
            'metadata', p.metadata
          )
        ) as prices
      FROM subscriptions s
      LEFT JOIN prices pr ON pr.id = s.price_id
      LEFT JOIN products p ON p.id = pr.product_id
      WHERE s.user_id = $1
        AND s.status IN ('trialing', 'active')
      ORDER BY s.created DESC
      LIMIT 1
    `, [user.id]);

    subscription = subscriptionResult.rows[0] || null;
  }

  return (
    <Pricing
      user={user}
      products={products ?? []}
      subscription={subscription}
    />
  );
}
