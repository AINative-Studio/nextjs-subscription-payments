/**
 * Subscription Helper Utilities
 * Provides formatting and validation functions for subscription data
 */

/**
 * Format a price amount to a localized currency string
 * @param amount - Amount in smallest currency unit (e.g., cents)
 * @param currency - Currency code (e.g., 'usd', 'eur')
 * @returns Formatted price string
 */
export function formatPrice(
  amount: number | null | undefined,
  currency: string | null | undefined
): string {
  if (amount === null || amount === undefined || !currency) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

/**
 * Format a subscription interval for display
 * @param interval - Billing interval (day, week, month, year)
 * @param intervalCount - Number of intervals
 * @returns Formatted interval string
 */
export function formatInterval(
  interval: string | null | undefined,
  intervalCount: number | null | undefined = 1
): string {
  if (!interval) {
    return '';
  }

  const count = intervalCount || 1;

  if (count === 1) {
    return interval;
  }

  // Pluralize based on count
  const pluralMap: Record<string, string> = {
    day: 'days',
    week: 'weeks',
    month: 'months',
    year: 'years',
  };

  const plural = pluralMap[interval] || interval;
  return `${count} ${plural}`;
}

/**
 * Get a human-readable subscription status
 * @param status - Subscription status enum value
 * @returns Human-readable status string
 */
export function getSubscriptionStatus(
  status: string | null | undefined
): string {
  if (!status) {
    return 'Unknown';
  }

  const statusMap: Record<string, string> = {
    trialing: 'Trial',
    active: 'Active',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    incomplete_expired: 'Incomplete (Expired)',
    past_due: 'Past Due',
    unpaid: 'Unpaid',
    paused: 'Paused',
  };

  return statusMap[status] || status;
}

/**
 * Check if a subscription is currently active (includes trialing)
 * @param status - Subscription status
 * @returns True if subscription is active or trialing
 */
export function isSubscriptionActive(
  status: string | null | undefined
): boolean {
  if (!status) {
    return false;
  }

  return status === 'active' || status === 'trialing';
}

/**
 * Calculate the next billing date from subscription data
 * @param currentPeriodEnd - ISO timestamp of current period end
 * @returns Formatted date string or null
 */
export function calculateNextBillingDate(
  currentPeriodEnd: string | null | undefined
): string | null {
  if (!currentPeriodEnd) {
    return null;
  }

  try {
    const date = new Date(currentPeriodEnd);
    // Check if date is invalid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', currentPeriodEnd);
      return null;
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Check if a subscription will cancel at period end
 * @param subscription - Subscription object
 * @returns True if subscription will cancel
 */
export function willCancelAtPeriodEnd(subscription: {
  cancel_at_period_end?: boolean | null;
}): boolean {
  return subscription.cancel_at_period_end === true;
}

/**
 * Get the subscription product name
 * @param subscription - Subscription with nested price and product data
 * @returns Product name or 'Unknown'
 */
export function getSubscriptionProductName(subscription: any): string {
  if (!subscription) {
    return 'No subscription';
  }

  try {
    return subscription.prices?.products?.name || 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Format subscription price with interval
 * @param subscription - Subscription with nested price data
 * @returns Formatted price string like "$10/month"
 */
export function formatSubscriptionPrice(subscription: any): string {
  if (!subscription || !subscription.prices) {
    return 'N/A';
  }

  const price = subscription.prices;
  const amount = formatPrice(price.unit_amount, price.currency);
  const interval = price.interval ? `/${price.interval}` : '';

  return `${amount}${interval}`;
}
