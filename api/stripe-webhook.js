/**
 * api/stripe-webhook.js
 *
 * Handles all incoming Stripe webhook events.
 *
 * SECURITY CRITICAL:
 * - Raw body is read from stream before any parsing (required for signature verification).
 * - Stripe signature is verified with stripe.webhooks.constructEvent before ANY processing.
 * - Service role key bypasses RLS — never expose to browser.
 *
 * RELIABILITY:
 * - Every event is logged to webhook_events table (idempotency + audit trail).
 * - Duplicate Stripe event IDs are silently acknowledged (return 200, skip processing).
 * - Processing errors return 500 so Stripe retries; the retry is allowed through
 *   because status='failed' events are re-processed.
 *
 * GET ?ping=1 — health check endpoint for admin UI.
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendCancellationEmail } from './lib/email.js'

// ── Clients ──────────────────────────────────────────────────────────────────

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

// Service-role client: bypasses RLS. Only use server-side.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Raw body reader (required for Stripe signature verification) ──────────────

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapStripeStatus(stripeStatus) {
  const map = {
    trialing:           'trialing',
    active:             'active',
    past_due:           'past_due',
    canceled:           'cancelled',
    incomplete:         'incomplete',
    incomplete_expired: 'expired',
    paused:             'paused',
    unpaid:             'past_due',
  }
  return map[stripeStatus] || 'active'
}

function getTierFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_TIER1_MONTHLY]: 'capture_i',
    [process.env.STRIPE_PRICE_TIER1_ANNUAL]:  'capture_i',
    [process.env.STRIPE_PRICE_TIER2_MONTHLY]: 'intelligence_ii',
    [process.env.STRIPE_PRICE_TIER2_ANNUAL]:  'intelligence_ii',
    [process.env.STRIPE_PRICE_TIER3_MONTHLY]: 'command_iii',
    [process.env.STRIPE_PRICE_TIER3_ANNUAL]:  'command_iii',
  }
  return map[priceId] || 'capture_i'
}

function getBillingPeriod(priceId) {
  const annual = [
    process.env.STRIPE_PRICE_TIER1_ANNUAL,
    process.env.STRIPE_PRICE_TIER2_ANNUAL,
    process.env.STRIPE_PRICE_TIER3_ANNUAL,
    process.env.STRIPE_PRICE_SEAT_ANNUAL,
  ]
  return annual.includes(priceId) ? 'annual' : 'monthly'
}

const SEAT_PRICES = () => [
  process.env.STRIPE_PRICE_SEAT_MONTHLY,
  process.env.STRIPE_PRICE_SEAT_ANNUAL,
]

function getAdminPriceId(subscription) {
  const seats = SEAT_PRICES()
  const item = subscription.items.data.find(i => !seats.includes(i.price.id))
  return item?.price?.id || null
}

function getSeatCount(subscription) {
  const seats = SEAT_PRICES()
  const item = subscription.items.data.find(i => seats.includes(i.price.id))
  return item ? item.quantity : 1
}

// ── Webhook event logging ─────────────────────────────────────────────────────

async function logEvent(stripeEventId, eventType, status, extra = {}) {
  try {
    await supabase.from('webhook_events').upsert({
      stripe_event_id: stripeEventId,
      event_type:      eventType,
      status,
      received_at:     extra.received_at || new Date().toISOString(),
      processed_at:    extra.processed_at || null,
      error_message:   extra.error_message || null,
      payload_json:    extra.payload_json || null,
      related_org_id:  extra.related_org_id || null,
    }, { onConflict: 'stripe_event_id' })
  } catch (e) {
    // Non-fatal: don't let logging failure crash the webhook
    console.error('[stripe-webhook] Failed to log event:', e.message)
  }
}

async function markEventResult(stripeEventId, status, extra = {}) {
  try {
    await supabase
      .from('webhook_events')
      .update({
        status,
        processed_at:  new Date().toISOString(),
        error_message: extra.error_message || null,
        related_org_id: extra.related_org_id || null,
      })
      .eq('stripe_event_id', stripeEventId)
  } catch (e) {
    console.error('[stripe-webhook] Failed to update event status:', e.message)
  }
}

// ── Idempotency check ─────────────────────────────────────────────────────────

async function isAlreadyProcessed(stripeEventId) {
  const { data } = await supabase
    .from('webhook_events')
    .select('status')
    .eq('stripe_event_id', stripeEventId)
    .single()

  // Allow re-processing if previous attempt failed or is stuck in processing
  if (!data) return false
  return data.status === 'success' || data.status === 'ignored'
}

// ── Subscription sync ─────────────────────────────────────────────────────────

async function syncSubscription(subscription, orgId) {
  const adminPriceId = getAdminPriceId(subscription)
  const seatItem = subscription.items.data.find(i => SEAT_PRICES().includes(i.price.id))

  const tier          = getTierFromPriceId(adminPriceId)
  const status        = mapStripeStatus(subscription.status)
  const billingPeriod = getBillingPeriod(adminPriceId)
  const seatCount     = seatItem ? seatItem.quantity : 1

  const { error: subErr } = await supabase.from('subscriptions').upsert({
    organization_id:        orgId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id:     subscription.customer,
    plan_tier:              tier,
    billing_period:         billingPeriod,
    status,
    current_period_end:     new Date(subscription.current_period_end * 1000).toISOString(),
    seat_count:             seatCount,
    admin_price_id:         adminPriceId,
    user_price_id:          seatItem?.price?.id || null,
  }, { onConflict: 'organization_id' })

  if (subErr) {
    console.error('[stripe-webhook] subscriptions upsert failed:', subErr)
    throw subErr
  }

  const { error: orgErr } = await supabase.from('organizations').update({
    subscription_tier:      tier,
    subscription_status:    status,
    stripe_customer_id:     subscription.customer,
    stripe_subscription_id: subscription.id,
  }).eq('id', orgId)

  if (orgErr) {
    console.error('[stripe-webhook] organizations update failed:', orgErr)
    throw orgErr
  }

  return orgId
}

// ── Event handlers ────────────────────────────────────────────────────────────

export async function handleCheckoutCompleted(session) {
  const orgId = session.metadata?.organization_id
  if (!orgId) {
    console.warn('[stripe-webhook] checkout.session.completed: no organization_id in metadata')
    return null
  }
  if (session.mode !== 'subscription') return null

  const subscription = await stripe.subscriptions.retrieve(session.subscription)
  await syncSubscription(subscription, orgId)
  console.log(`[stripe-webhook] checkout completed for org ${orgId}`)
  return orgId
}

export async function handleSubscriptionUpdated(subscription) {
  let org = null

  const { data: bySubId } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (bySubId) {
    org = bySubId
  } else {
    const { data: byCustomerId } = await supabase
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .maybeSingle()
    org = byCustomerId
  }

  if (!org) {
    console.warn(`[stripe-webhook] no org for subscription ${subscription.id}`)
    return null
  }

  await syncSubscription(subscription, org.id)

  if (subscription.status === 'canceled') {
    await supabase.from('organizations').update({
      cancelled_at:        new Date().toISOString(),
      data_delete_at:      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_status: 'cancelled',
    }).eq('id', org.id)
  }

  console.log(`[stripe-webhook] subscription updated for org ${org.id}`)
  return org.id
}

export async function handleSubscriptionDeleted(subscription) {
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!org) return null

  const now      = new Date()
  const deleteAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  await supabase.from('organizations').update({
    subscription_status: 'cancelled',
    subscription_tier:   'trial',
    cancelled_at:        now.toISOString(),
    data_delete_at:      deleteAt.toISOString(),
  }).eq('id', org.id)

  await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('organization_id', org.id)

  // Send cancellation email (non-fatal)
  try {
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('organization_id', org.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (adminProfile?.email) {
      const firstName = adminProfile.full_name?.split(' ')[0] || 'there'
      await sendCancellationEmail({ to: adminProfile.email, firstName })
    }
  } catch (emailErr) {
    console.error('[stripe-webhook] cancellation email error (non-fatal):', emailErr.message)
  }

  console.log(`[stripe-webhook] subscription deleted for org ${org.id}, data_delete_at: ${deleteAt}`)
  return org.id
}

export async function handlePaymentFailed(invoice) {
  if (!invoice.subscription) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', invoice.subscription)
    .maybeSingle()

  if (!org) return null

  await supabase.from('organizations').update({ subscription_status: 'past_due' }).eq('id', org.id)
  await supabase.from('subscriptions').update({ status: 'past_due' }).eq('organization_id', org.id)

  console.log(`[stripe-webhook] payment failed for org ${org.id}`)
  return org.id
}

// ── Retry handler (merged from retry-webhook.js to stay under Vercel Hobby 12-fn limit) ──

const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]

async function handleRetryAction(req, res) {
  // Auth: must be a super_admin session
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.slice(7)

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden — super_admin only' })
  }

  // Parse JSON body (this branch is NOT a Stripe webhook, so normal JSON is fine)
  let body = req.body
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}') } catch { body = {} }
  }

  const { event_id } = body
  if (!event_id) return res.status(400).json({ error: 'event_id is required' })

  const { data: stored, error: fetchErr } = await supabase
    .from('webhook_events').select('*').eq('id', event_id).single()
  if (fetchErr || !stored) return res.status(404).json({ error: 'Event not found' })
  if (stored.status === 'success') {
    return res.status(200).json({ ok: true, message: 'Already succeeded — no retry needed' })
  }
  if (!HANDLED_EVENTS.includes(stored.event_type)) {
    return res.status(400).json({ error: `${stored.event_type} is not retryable` })
  }
  if (!stored.payload_json) {
    return res.status(400).json({ error: 'No stored payload to retry with' })
  }

  await supabase.from('webhook_events')
    .update({ status: 'processing', error_message: null }).eq('id', event_id)

  const eventData = stored.payload_json?.data?.object || stored.payload_json

  try {
    let orgId = null
    switch (stored.event_type) {
      case 'checkout.session.completed':   orgId = await handleCheckoutCompleted(eventData);  break
      case 'customer.subscription.updated': orgId = await handleSubscriptionUpdated(eventData); break
      case 'customer.subscription.deleted': orgId = await handleSubscriptionDeleted(eventData); break
      case 'invoice.payment_failed':        orgId = await handlePaymentFailed(eventData);       break
    }
    await supabase.from('webhook_events').update({
      status: 'success', processed_at: new Date().toISOString(),
      error_message: null, related_org_id: orgId || stored.related_org_id,
    }).eq('id', event_id)
    console.log(`[stripe-webhook/retry] Success: ${event_id} (${stored.event_type})`)
    return res.status(200).json({ ok: true, event_type: stored.event_type, org_id: orgId })
  } catch (err) {
    console.error(`[stripe-webhook/retry] Failed: ${event_id}:`, err.message)
    await supabase.from('webhook_events').update({
      status: 'failed', processed_at: new Date().toISOString(), error_message: err.message,
    }).eq('id', event_id)
    return res.status(500).json({ error: err.message })
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // ── Health check for admin UI ─────────────────────────────────────────────
  if (req.method === 'GET') {
    if (req.query?.ping === '1' || req.url?.includes('ping=1')) {
      const env = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live'
      return res.status(200).json({ ok: true, env, ts: new Date().toISOString() })
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Retry action (delegated before raw-body read) ─────────────────────────
  const qs = req.url?.includes('?') ? new URLSearchParams(req.url.split('?')[1]) : null
  const action = qs?.get('action') || req.query?.action
  if (action === 'retry') {
    return handleRetryAction(req, res)
  }

  // ── 1. Read raw body (required for Stripe signature verification) ─────────
  let rawBody
  try {
    rawBody = await readRawBody(req)
  } catch (err) {
    console.error('[stripe-webhook] Failed to read request body:', err.message)
    return res.status(400).json({ error: 'Failed to read request body' })
  }

  // ── 2. Verify Stripe signature ────────────────────────────────────────────
  const sig = req.headers['stripe-signature']
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` })
  }

  // ── 3. Idempotency: skip if already successfully processed ────────────────
  try {
    const alreadyDone = await isAlreadyProcessed(event.id)
    if (alreadyDone) {
      console.log(`[stripe-webhook] Duplicate event ${event.id} — skipping`)
      return res.status(200).json({ received: true, duplicate: true })
    }
  } catch (idempErr) {
    console.warn('[stripe-webhook] Idempotency check failed (continuing):', idempErr.message)
  }

  // ── 4. Log event as received ──────────────────────────────────────────────
  const receivedAt = new Date().toISOString()
  const payloadJson = JSON.parse(rawBody.toString())

  await logEvent(event.id, event.type, 'processing', {
    received_at:  receivedAt,
    payload_json: payloadJson,
  })

  if (!HANDLED_EVENTS.includes(event.type)) {
    await markEventResult(event.id, 'ignored')
    return res.status(200).json({ received: true, ignored: true })
  }

  // ── 5. Process event ──────────────────────────────────────────────────────
  try {
    let orgId = null

    switch (event.type) {
      case 'checkout.session.completed':
        orgId = await handleCheckoutCompleted(event.data.object)
        break
      case 'customer.subscription.updated':
        orgId = await handleSubscriptionUpdated(event.data.object)
        break
      case 'customer.subscription.deleted':
        orgId = await handleSubscriptionDeleted(event.data.object)
        break
      case 'invoice.payment_failed':
        orgId = await handlePaymentFailed(event.data.object)
        break
    }

    await markEventResult(event.id, 'success', { related_org_id: orgId })
    return res.status(200).json({ received: true })

  } catch (err) {
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, err.message)
    await markEventResult(event.id, 'failed', { error_message: err.message })
    // Return 500 so Stripe retries — the retry will re-enter processing
    // because status='failed' does not trigger the idempotency skip
    return res.status(500).json({ error: 'Processing failed — will retry' })
  }
}
