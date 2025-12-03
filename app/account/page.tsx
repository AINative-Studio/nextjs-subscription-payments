import CustomerPortalForm from '@/components/ui/AccountForms/CustomerPortalForm';
import EmailForm from '@/components/ui/AccountForms/EmailForm';
import NameForm from '@/components/ui/AccountForms/NameForm';
import { redirect } from 'next/navigation';
import { query } from '@/lib/zerodb';
import { getUser } from '@/lib/auth';
import { cookies } from 'next/headers';

export default async function Account() {
  // Get user from JWT token
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) {
    redirect('/signin');
  }

  let user;
  try {
    user = await getUser(token);
  } catch (error) {
    // Token is invalid or expired
    redirect('/signin');
  }

  // Get user details from database
  const userDetailsResult = await query(
    'SELECT id, email, full_name, avatar_url, billing_address, payment_method FROM users WHERE id = $1',
    [user.id]
  );

  const userDetails = userDetailsResult.rows[0] || null;

  // Get subscription with nested price and product data
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

  const subscription = subscriptionResult.rows[0] || null;

  return (
    <section className="mb-32 bg-black">
      <div className="max-w-6xl px-4 py-8 mx-auto sm:px-6 sm:pt-24 lg:px-8">
        <div className="sm:align-center sm:flex sm:flex-col">
          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            Account
          </h1>
          <p className="max-w-2xl m-auto mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl">
            We partnered with Stripe for a simplified billing.
          </p>
        </div>
      </div>
      <div className="p-4">
        <CustomerPortalForm subscription={subscription} />
        <NameForm userName={userDetails?.full_name ?? ''} />
        <EmailForm userEmail={user.email} />
      </div>
    </section>
  );
}
