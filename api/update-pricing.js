/**
 * api/update-pricing.js
 *
 * Pricing control endpoint — super admin only.
 *
 * POST body:
 *   { mode: 'new_customers' | 'all_customers', prices: PriceEntry[] }
 *
 * PriceEntry: { tier, billing_period, price_type, amount }
 *
 * mode = 'new_customers'  → update pricing_config only (new signups see new prices)
 * mode = 'all_customers'  → update pricing_config + update all active Stripe subs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Stripe product IDs per tier — set in Vercel env vars once Stripe is fully configured
const STRIPE_PRODUCTS = {
  capture_i:      process.env.STRIPE_PRODUCT_CAPTURE_I,
  intelligence_ii: process.env.STRIPE_PRODUCT_INTELLIGENCE_II,
  command_iii:    process.env.STRIPE_PRODUCT_COMMAND_III,
}

// ── Auth helpers ────────────────────────────────────────────────────────────

async function verifyRequest(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, user_id')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') return null
  return profile
}

// ── Stripe helpers ──────────────────────────────────────────────────────────

async function createStripePrice(amount, billingPeriod, productId) {
  const body = new URLSearchParams()
  body.append('unit_amount', String(Math.round(amount * 100)))
  body.append('currency', 'usd')
  body.append('recurring[interval]', billingPeriod === 'annual' ? 'year' : 'month')
  body.append('product', productId)

  const res = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  return res.json()
}

// ── DB config ID builder ────────────────────────────────────────────────────

function configId(tier, billingPeriod, priceType) {
  // price_type 'per_seat' → 'seat' in the ID
  const typeSlug = priceType === 'per_seat' ? 'seat' : priceType
  return `${tier}_${billingPeriod}_${typeSlug}`
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth: must be super_admin
  const profile = await verifyRequest(req)
  if (!profile) {
    return res.status(403).json({ error: 'Forbidden: super_admin access required' })
  }

  const { mode, prices } = req.body

  if (!['new_customers', 'all_customers'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' })
  }
  if (!Array.isArray(prices) || prices.length === 0) {
    return res.status(400).json({ error: 'prices array required' })
  }

  const stripeAvailable = !!process.env.STRIPE_SECRET_KEY
  const stripeResults = []

  // ── 1. For each price entry: optionally create Stripe price, then upsert DB ──
  for (const entry of prices) {
    const { tier, billing_period, price_type, amount } = entry

    // Validate
    if (!['capture_i', 'intelligence_ii', 'command_iii'].includes(tier)) continue
    if (!['monthly', 'annual'].includes(billing_period)) continue
    if (!['admin', 'per_seat'].includes(price_type)) continue
    if (typeof amount !== 'number' || amount <= 0) continue

    const id = configId(tier, billing_period, price_type)
    let stripe_price_id = null

    // Create new Stripe price (prices are immutable)
    if (stripeAvailable && STRIPE_PRODUCTS[tier]) {
      try {
        const newPrice = await createStripePrice(amount, billing_period, STRIPE_PRODUCTS[tier])
        if (newPrice?.id) {
          stripe_price_id = newPrice.id
          stripeResults.push({ id, stripe_price_id })
        }
      } catch (err) {
        console.error(`[update-pricing] Stripe price creation failed for ${id}:`, err)
      }
    }

    // Upsert pricing_config
    const upsertData = {
      id,
      tier,
      billing_period,
      price_type,
      amount,
      updated_at: new Date().toISOString(),
      updated_by: profile.user_id,
    }
    if (stripe_price_id) upsertData.stripe_price_id = stripe_price_id

    await supabaseAdmin.from('pricing_config').upsert(upsertData)
  }

  let updatedCount = 0

  // ── 2. If all_customers: update active Stripe subscriptions ─────────────────
  if (mode === 'all_customers' && stripeAvailable) {
    // Get all active non-enterprise orgs with a Stripe subscription
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, stripe_subscription_id, stripe_customer_id, subscription_tier, billing_period, custom_price_override')
      .eq('subscription_status', 'active')
      .neq('plan_type', 'enterprise')
      .is('custom_price_override', null)  // skip custom pricing

    if (orgs && orgs.length > 0) {
      for (const org of orgs) {
        if (!org.stripe_subscription_id) continue

        // Find the matching new prices for this org's tier & billing period
        const relevantPrices = prices.filter(p =>
          p.tier === org.subscription_tier &&
          p.billing_period === org.billing_period
        )

        if (relevantPrices.length === 0) continue

        // Get stripe price IDs we just created
        const newPriceIds = stripeResults
          .filter(r => relevantPrices.some(p =>
            r.id === configId(p.tier, p.billing_period, p.price_type)
          ))
          .map(r => r.stripe_price_id)

        if (newPriceIds.length === 0) continue

        try {
          // Retrieve the subscription to get item IDs
          const subRes = await fetch(
            `https://api.stripe.com/v1/subscriptions/${org.stripe_subscription_id}`,
            {
              headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
            }
          )
          const sub = await subRes.json()
          if (!sub?.items?.data) continue

          // Update each subscription item with the new price
          const items = sub.items.data.map((item, i) => ({
            id: item.id,
            price: newPriceIds[i] || newPriceIds[0],
          }))

          const updateBody = new URLSearchParams()
          updateBody.append('proration_behavior', 'none')
          items.forEach((item, i) => {
            updateBody.append(`items[${i}][id]`, item.id)
            updateBody.append(`items[${i}][price]`, item.price)
          })

          const updateRes = await fetch(
            `https://api.stripe.com/v1/subscriptions/${org.stripe_subscription_id}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: updateBody.toString(),
            }
          )
          const updated = await updateRes.json()
          if (updated?.id) updatedCount++
        } catch (err) {
          console.error(`[update-pricing] Failed to update sub for org ${org.id}:`, err)
        }
      }
    }
  }

  // ── 3. Audit log ─────────────────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_log').insert({
      event_type: mode === 'new_customers'
        ? 'pricing.new_customer_updated'
        : 'pricing.global_updated',
      details: { prices, updated_count: updatedCount },
      performed_by: profile.user_id,
    })
  } catch (err) {
    // Audit log failure is non-fatal
    console.error('[update-pricing] Audit log insert failed:', err)
  }

  return res.status(200).json({
    success: true,
    mode,
    updated_count: updatedCount,
    stripe_prices_created: stripeResults.length,
    stripe_available: stripeAvailable,
  })
}
