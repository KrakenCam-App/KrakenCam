/**
 * src/lib/subscriptions.js
 *
 * Subscription management helpers.
 * Read operations happen client-side (RLS allows users to see their own sub).
 * Write operations (upgrade/cancel) go through Stripe and our API routes.
 */

import { supabase } from './supabase';
import { getAccessToken } from './supabase';

/**
 * Get the current org's subscription record from Supabase.
 * RLS ensures users can only see their own org's subscription.
 */
export async function getMySubscription() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Redirect to Stripe Checkout to start or upgrade a subscription.
 *
 * @param {object} params
 * @param {string} params.tier         - 'capture_i' | 'intelligence_ii' | 'command_iii'
 * @param {string} params.billingPeriod - 'monthly' | 'annual'
 * @param {number} params.seatCount    - Number of user seats
 * @param {string} [params.discountCode] - Optional promo code
 */
export async function startCheckout({ tier, billingPeriod, seatCount = 1, discountCode }) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/create-checkout-session', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ tier, billingPeriod, seatCount, discountCode }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create checkout session');

  // Redirect to Stripe Checkout
  window.location.href = data.url;
}

/**
 * Redirect to Stripe Customer Portal for billing management.
 */
export async function openBillingPortal() {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/create-portal-session', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');

  window.location.href = data.url;
}

/**
 * Check if the current subscription is in a usable state.
 */
export function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  return ['trialing', 'active'].includes(subscription.status);
}

/**
 * Get days remaining in trial.
 * Returns null if not in trial.
 */
export function getTrialDaysRemaining(subscription) {
  if (!subscription || subscription.status !== 'trialing') return null;
  if (!subscription.current_period_end) return null;

  const msLeft = new Date(subscription.current_period_end) - new Date();
  return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
}

/**
 * Validate a discount code (read-only check against discount_codes table).
 */
export async function validateDiscountCode(code) {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('code, discount_percent, expires_at, max_uses, used_count')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) return { valid: false, reason: 'Code not found' };

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, reason: 'Code has expired' };
  }

  if (data.max_uses !== null && data.used_count >= data.max_uses) {
    return { valid: false, reason: 'Code has reached its usage limit' };
  }

  return {
    valid:           true,
    discountPercent: data.discount_percent,
    code:            data.code,
  };
}
