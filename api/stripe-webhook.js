/**
 * api/stripe-webhook.js
 * 
 * Handles all incoming Stripe webhook events.
 * 
 * SECURITY CRITICAL:
 * - We verify the webhook signature before processing ANYTHING.
 * - We use the Supabase SERVICE ROLE key here (bypasses RLS) because
 *   webhook events come from Stripe, not from a logged-in user.
 * - Never expose the service role key to the browser.
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Service role client - bypasses RLS. Only use server-side.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // NOT the anon key
);

/**
 * Map Stripe status to our internal status enum
 */
function mapStripeStatus(stripeStatus) {
  const statusMap = {
    'trialing':          'trialing',
    'active':            'active',
    'past_due':          'past_due',
    'canceled':          'cancelled',
    'incomplete':        'incomplete',
    'incomplete_expired':'expired',
    'paused':            'paused',
    'unpaid':            'past_due',
  };
  return statusMap[stripeStatus] || 'active';
}

/**
 * Map Stripe price ID to our internal tier name
 */
function getTierFromPriceId(priceId) {
  const tierMap = {
    [process.env.STRIPE_PRICE_TIER1_MONTHLY]: 'capture_i',
    [process.env.STRIPE_PRICE_TIER1_ANNUAL]:  'capture_i',
    [process.env.STRIPE_PRICE_TIER2_MONTHLY]: 'intelligence_ii',
    [process.env.STRIPE_PRICE_TIER2_ANNUAL]:  'intelligence_ii',
    [process.env.STRIPE_PRICE_TIER3_MONTHLY]: 'command_iii',
    [process.env.STRIPE_PRICE_TIER3_ANNUAL]:  'command_iii',
  };
  return tierMap[priceId] || 'capture_i';
}

/**
 * Determine billing period from price ID
 */
function getBillingPeriod(priceId) {
  const annualPrices = [
    process.env.STRIPE_PRICE_TIER1_ANNUAL,
    process.env.STRIPE_PRICE_TIER2_ANNUAL,
    process.env.STRIPE_PRICE_TIER3_ANNUAL,
    process.env.STRIPE_PRICE_SEAT_ANNUAL,
  ];
  return annualPrices.includes(priceId) ? 'annual' : 'monthly';
}

/**
 * Get seat count from subscription items
 */
function getSeatCount(subscription) {
  const seatPrices = [
    process.env.STRIPE_PRICE_SEAT_MONTHLY,
    process.env.STRIPE_PRICE_SEAT_ANNUAL,
  ];
  const seatItem = subscription.items.data.find(item =>
    seatPrices.includes(item.price.id)
  );
  return seatItem ? seatItem.quantity : 1;
}

/**
 * Get admin base price ID from subscription items
 */
function getAdminPriceId(subscription) {
  const seatPrices = [
    process.env.STRIPE_PRICE_SEAT_MONTHLY,
    process.env.STRIPE_PRICE_SEAT_ANNUAL,
  ];
  const adminItem = subscription.items.data.find(item =>
    !seatPrices.includes(item.price.id)
  );
  return adminItem?.price?.id || null;
}

/**
 * Update subscription record in Supabase from a Stripe subscription object
 */
async function syncSubscription(stripeSubscription, orgId) {
  const adminPriceId = getAdminPriceId(stripeSubscription);
  const seatPrices = [
    process.env.STRIPE_PRICE_SEAT_MONTHLY,
    process.env.STRIPE_PRICE_SEAT_ANNUAL,
  ];
  const seatItem = stripeSubscription.items.data.find(item =>
    seatPrices.includes(item.price.id)
  );

  const tier = getTierFromPriceId(adminPriceId);
  const status = mapStripeStatus(stripeSubscription.status);
  const billingPeriod = getBillingPeriod(adminPriceId);
  const seatCount = seatItem ? seatItem.quantity : 1;

  // Update the subscriptions table
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      organization_id:       orgId,
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id:    stripeSubscription.customer,
      plan_tier:             tier,
      billing_period:        billingPeriod,
      status:                status,
      current_period_end:    new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      seat_count:            seatCount,
      admin_price_id:        adminPriceId,
      user_price_id:         seatItem?.price?.id || null,
    }, { onConflict: 'organization_id' });

  if (subError) {
    console.error('[stripe-webhook] Failed to update subscriptions table:', subError);
    throw subError;
  }

  // Also sync the denormalized fields on the organizations table
  const { error: orgError } = await supabase
    .from('organizations')
    .update({
      subscription_tier:      tier,
      subscription_status:    status,
      stripe_customer_id:     stripeSubscription.customer,
      stripe_subscription_id: stripeSubscription.id,
    })
    .eq('id', orgId);

  if (orgError) {
    console.error('[stripe-webhook] Failed to update organizations table:', orgError);
    throw orgError;
  }
}

/**
 * Handle checkout.session.completed
 * First-time subscription - link Stripe customer to our org.
 */
async function handleCheckoutCompleted(session) {
  const orgId = session.metadata?.organization_id;
  if (!orgId) {
    console.error('[stripe-webhook] No organization_id in checkout session metadata');
    return;
  }

  if (session.mode !== 'subscription') return;

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  await syncSubscription(subscription, orgId);

  console.log(`[stripe-webhook] Checkout completed for org ${orgId}`);
}

/**
 * Handle customer.subscription.updated
 * Plan changes, seat changes, status changes.
 */
async function handleSubscriptionUpdated(subscription) {
  // Look up org by stripe_subscription_id or stripe_customer_id
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (error || !org) {
    // Try by customer ID as fallback
    const { data: orgByCustomer, error: err2 } = await supabase
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (err2 || !orgByCustomer) {
      console.warn(`[stripe-webhook] No org found for subscription ${subscription.id}`);
      return;
    }
    await syncSubscription(subscription, orgByCustomer.id);
    return;
  }

  await syncSubscription(subscription, org.id);

  // If subscription is now cancelled, set data_delete_at (60 days from now)
  if (subscription.status === 'canceled') {
    await supabase
      .from('organizations')
      .update({
        cancelled_at:    new Date().toISOString(),
        data_delete_at:  new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_status: 'cancelled',
      })
      .eq('id', org.id);
  }

  console.log(`[stripe-webhook] Subscription updated for org ${org.id}`);
}

/**
 * Handle customer.subscription.deleted
 * Subscription fully cancelled.
 */
async function handleSubscriptionDeleted(subscription) {
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!org) return;

  const now = new Date();
  const deleteAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

  await supabase
    .from('organizations')
    .update({
      subscription_status: 'cancelled',
      subscription_tier:   'trial',
      cancelled_at:        now.toISOString(),
      data_delete_at:      deleteAt.toISOString(),
    })
    .eq('id', org.id);

  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('organization_id', org.id);

  console.log(`[stripe-webhook] Subscription deleted for org ${org.id}, data_delete_at: ${deleteAt}`);
}

/**
 * Handle invoice.payment_failed
 * Mark subscription as past_due.
 */
async function handlePaymentFailed(invoice) {
  if (!invoice.subscription) return;

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', invoice.subscription)
    .single();

  if (!org) return;

  await supabase
    .from('organizations')
    .update({ subscription_status: 'past_due' })
    .eq('id', org.id);

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('organization_id', org.id);

  console.log(`[stripe-webhook] Payment failed for org ${org.id}`);
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Verify webhook signature before processing
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    // req.body must be the raw Buffer (see Vercel config below)
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        // Unhandled event type - that's fine, just acknowledge
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    // Return 500 so Stripe retries the webhook
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * IMPORTANT: Vercel config - disable body parsing so we get the raw body
 * for Stripe signature verification. Without this, signature verification FAILS.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};
