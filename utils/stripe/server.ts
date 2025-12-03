'use server';

import Stripe from 'stripe';
import { stripe } from '@/utils/stripe/config';
import { query } from '@/lib/zerodb';
import { headers } from 'next/headers';
import {
  getURL,
  getErrorRedirect as getErrorRedirectHelper,
  calculateTrialEndUnixTimestamp as calculateTrialHelper
} from '@/utils/helpers';
import { Tables } from '@/types_db';

type Price = Tables<'prices'>;

// Re-export helper functions for tests
export { getErrorRedirectHelper as getErrorRedirect, calculateTrialHelper as calculateTrialEndUnixTimestamp };

/**
 * Create or retrieve a Stripe customer for the given user
 */
async function createOrRetrieveCustomer(userId: string, email: string): Promise<string> {
  try {
    // Check if customer already exists
    const result = await query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length > 0 && result.rows[0].stripe_customer_id) {
      return result.rows[0].stripe_customer_id;
    }

    // Create new customer in Stripe
    const customer = await stripe.customers.create({
      email,
      metadata: {
        user_id: userId,
      },
    });

    // Store customer ID in database
    await query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, userId]
    );

    return customer.id;
  } catch (error) {
    console.error('Error creating/retrieving customer:', error);
    throw new Error('Unable to access customer record.');
  }
}

/**
 * Get the current user from request headers (set by middleware)
 */
async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const headersList = headers();
  const userId = headersList.get('x-user-id');
  const userEmail = headersList.get('x-user-email');

  if (!userId || !userEmail) {
    return null;
  }

  return {
    id: userId,
    email: userEmail,
  };
}

type CheckoutResponse = {
  errorRedirect?: string;
  sessionId?: string;
};

export async function checkoutWithStripe(
  price: Price,
  redirectPath: string = '/account'
): Promise<CheckoutResponse> {
  try {
    // Get the user from request headers (set by middleware)
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Could not get user session.');
    }

    // Retrieve or create the customer in Stripe
    let customer: string;
    try {
      customer = await createOrRetrieveCustomer(user.id, user.email);
    } catch (err) {
      console.error(err);
      throw new Error('Unable to access customer record.');
    }

    let params: Stripe.Checkout.SessionCreateParams = {
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer,
      customer_update: {
        address: 'auto'
      },
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      cancel_url: getURL(),
      success_url: getURL(redirectPath)
    };

    console.log(
      'Trial end:',
      calculateTrialHelper(price.trial_period_days)
    );
    if (price.type === 'recurring') {
      params = {
        ...params,
        mode: 'subscription',
        subscription_data: {
          trial_end: calculateTrialHelper(price.trial_period_days)
        }
      };
    } else if (price.type === 'one_time') {
      params = {
        ...params,
        mode: 'payment'
      };
    }

    // Create a checkout session in Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.create(params);
    } catch (err) {
      console.error(err);
      throw new Error('Unable to create checkout session.');
    }

    // Instead of returning a Response, just return the data or error.
    if (session) {
      return { sessionId: session.id };
    } else {
      throw new Error('Unable to create checkout session.');
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        errorRedirect: getErrorRedirectHelper(
          redirectPath,
          error.message,
          'Please try again later or contact a system administrator.'
        )
      };
    } else {
      return {
        errorRedirect: getErrorRedirectHelper(
          redirectPath,
          'An unknown error occurred.',
          'Please try again later or contact a system administrator.'
        )
      };
    }
  }
}

export async function createStripePortal(currentPath: string) {
  try {
    // Get the user from request headers (set by middleware)
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Could not get user session.');
    }

    let customer;
    try {
      customer = await createOrRetrieveCustomer(user.id, user.email);
    } catch (err) {
      console.error(err);
      throw new Error('Unable to access customer record.');
    }

    if (!customer) {
      throw new Error('Could not get customer.');
    }

    try {
      const { url } = await stripe.billingPortal.sessions.create({
        customer,
        return_url: getURL('/account')
      });
      if (!url) {
        throw new Error('Could not create billing portal');
      }
      return url;
    } catch (err) {
      console.error(err);
      throw new Error('Could not create billing portal');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return getErrorRedirectHelper(
        currentPath,
        error.message,
        'Please try again later or contact a system administrator.'
      );
    } else {
      return getErrorRedirectHelper(
        currentPath,
        'An unknown error occurred.',
        'Please try again later or contact a system administrator.'
      );
    }
  }
}
