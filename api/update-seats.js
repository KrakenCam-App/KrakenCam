/**
 * api/update-seats.js
 *
 * Updates the seat quantity on the org's active Stripe subscription.
 * Called whenever an admin adds or removes a team member.
 *
 * SECURITY:
 * - Requires authenticated admin user (Supabase JWT)
 * - Organization ID pulled from server-side profile lookup
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEAT_PRICES = [
  process.env.STRIPE_PRICE_SEAT_MONTHLY,
  process.env.STRIPE_PRICE_SEAT_ANNUAL,
].filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return res.status(403).json({ error: 'Only org admins can update seats' });
  }

  const { seatCount } = req.body;
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 999) {
    return res.status(400).json({ error: 'Invalid seat count' });
  }

  // Get the org's active subscription
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('organization_id', profile.organization_id)
    .single();

  if (!sub?.stripe_subscription_id) {
    // No active Stripe subscription yet (e.g. still on trial) — skip silently
    return res.status(200).json({ skipped: true, reason: 'No active Stripe subscription' });
  }

  try {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

    const seatItem = stripeSub.items.data.find(item =>
      SEAT_PRICES.includes(item.price.id)
    );

    if (!seatItem) {
      return res.status(400).json({ error: 'No seat line item found on this subscription' });
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: seatItem.id, quantity: seatCount }],
      proration_behavior: 'always_invoice',
    });

    // Keep Supabase in sync
    await supabaseAdmin
      .from('subscriptions')
      .update({ seat_count: seatCount })
      .eq('organization_id', profile.organization_id);

    return res.status(200).json({ success: true, seatCount });
  } catch (err) {
    console.error('[update-seats] Stripe error:', err);
    return res.status(500).json({ error: 'Failed to update seat count' });
  }
}
