/**
 * api/create-checkout-session.js
 *
 * Creates a Stripe Checkout session for new subscriptions.
 *
 * SECURITY:
 * - Requires authenticated user (validates Supabase JWT server-side)
 * - Only the org admin can initiate checkout
 * - organization_id is pulled from the verified profile, NOT from the request body
 *   (prevents users from initiating checkout for another org)
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Service role client for server-side profile lookups
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Price ID map - keyed by tier and billing period
const PRICE_IDS = {
  capture_i: {
    monthly: process.env.STRIPE_PRICE_TIER1_MONTHLY,
    annual:  process.env.STRIPE_PRICE_TIER1_ANNUAL,
  },
  intelligence_ii: {
    monthly: process.env.STRIPE_PRICE_TIER2_MONTHLY,
    annual:  process.env.STRIPE_PRICE_TIER2_ANNUAL,
  },
  command_iii: {
    monthly: process.env.STRIPE_PRICE_TIER3_MONTHLY,
    annual:  process.env.STRIPE_PRICE_TIER3_ANNUAL,
  },
};

const SEAT_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_SEAT_MONTHLY,
  annual:  process.env.STRIPE_PRICE_SEAT_ANNUAL,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate the request by verifying the Supabase JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify the JWT and get user info
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Look up the user's profile to get org info and verify they're an admin
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Profile not found' });
  }

  if (profile.role !== 'admin') {
    return res.status(403).json({ error: 'Only org admins can manage subscriptions' });
  }

  const { tier, billingPeriod, seatCount = 1, discountCode } = req.body;

  // Validate inputs
  if (!PRICE_IDS[tier]) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  if (!['monthly', 'annual'].includes(billingPeriod)) {
    return res.status(400).json({ error: 'Invalid billing period' });
  }
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 999) {
    return res.status(400).json({ error: 'Invalid seat count' });
  }

  const orgId = profile.organization_id;

  // Get the org to check if they already have a Stripe customer
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('stripe_customer_id, name')
    .eq('id', orgId)
    .single();

  try {
    // Build discount code if provided (validate it first)
    let discounts = [];
    if (discountCode) {
      const { data: code } = await supabaseAdmin
        .from('discount_codes')
        .select('*')
        .eq('code', discountCode.toUpperCase())
        .single();

      if (
        code &&
        (!code.expires_at || new Date(code.expires_at) > new Date()) &&
        (!code.max_uses || code.used_count < code.max_uses)
      ) {
        // Create a Stripe coupon for this discount if it doesn't exist
        const stripeCoupon = await stripe.coupons.create({
          percent_off: code.discount_percent,
          duration: 'once',
          name: `KrakenCam ${code.discount_percent}% off`,
          metadata: { krakencam_code: code.code },
        });
        discounts = [{ coupon: stripeCoupon.id }];
      }
    }

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price:    PRICE_IDS[tier][billingPeriod],
          quantity: 1,
        },
        {
          price:    SEAT_PRICE_IDS[billingPeriod],
          quantity: seatCount,
        },
      ],
      // SECURITY: Store org ID in metadata - this is how the webhook links the
      // subscription back to the correct org after checkout completes.
      metadata: {
        organization_id: orgId,
        tier,
        billing_period: billingPeriod,
      },
      subscription_data: {
        metadata: {
          organization_id: orgId,
        },
        trial_period_days: 14,  // 14-day free trial
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/billing?cancelled=true`,
      allow_promotion_codes: false, // We handle discount codes ourselves
    };

    // Attach existing Stripe customer if they have one
    if (org?.stripe_customer_id) {
      sessionParams.customer = org.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email;
      sessionParams.customer_creation = 'always';
    }

    if (discounts.length > 0) {
      sessionParams.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] Stripe error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
