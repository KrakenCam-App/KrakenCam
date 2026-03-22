/**
 * admin.js - KrakenCam Super Admin Supabase Queries
 * All functions verify super_admin role before executing.
 * Uses anon key; RLS super_admin bypass policies handle access.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Singleton admin client (same anon key — RLS policies for super_admin handle the rest)
let _adminClient = null
export function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        storageKey: 'kraken-admin',
        autoRefreshToken: true,
      }
    })
  }
  return _adminClient
}
// ─── Auth Helper ──────────────────────────────────────────────────────────────

/**
 * Returns true if the currently authenticated user has role='super_admin'.
 */
export async function isSuperAdmin() {
  const supabase = getAdminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (error || !data) return false
  return data.role === 'super_admin'
}

async function requireAdmin() {
  const ok = await isSuperAdmin()
  if (!ok) throw new Error('Unauthorized: super_admin role required')
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

/**
 * Log an admin action to the audit_log table.
 * Non-blocking — errors are swallowed so they never break the main action.
 */
export async function logAuditEvent(eventType, targetId, targetType, details) {
  const supabase = getAdminClient()
  await supabase
    .from('audit_log')
    .insert({
      event_type: eventType,
      target_id: targetId,
      target_type: targetType,
      details: details || {},
    })
    .catch(e => console.error('[Audit Log] Failed:', e))
}

// ─── Overview Stats ──────────────────────────────────────────────────────────

/**
 * Returns aggregate platform stats for the overview dashboard.
 */
export async function getOverviewStats() {
  await requireAdmin()
  const supabase = getAdminClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: totalOrgs },
    { count: orgsThisMonth },
    { count: totalUsers },
    { count: totalJobsites },
    { count: activeTrials },
    { data: tierData },
    { data: recentOrgs },
  ] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('organizations')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'trialing'),
    supabase.from('organizations')
      .select('subscription_tier, subscription_status')
      .eq('subscription_status', 'active'),
    supabase.from('organizations')
      .select('name, subscription_tier, subscription_status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Compute tier distribution & revenue estimate
  const tierCounts = { capture_i: 0, intelligence_ii: 0, command_iii: 0 }
  const adminPriceMap = {
    capture_i: { monthly: 39, annual: 33 },
    intelligence_ii: { monthly: 59, annual: 50 },
    command_iii: { monthly: 79, annual: 67 },
  }
  const seatPriceMap = { monthly: 29, annual: 26 }

  let monthlyRevenueEstimate = 0

  ;(tierData || []).forEach(org => {
    const tier = org.subscription_tier || 'capture_i'
    tierCounts[tier] = (tierCounts[tier] || 0) + 1
    const period = 'monthly'
    const adminPrice = adminPriceMap[tier]?.[period] || 39
    const seatPrice = seatPriceMap[period]
    monthlyRevenueEstimate += adminPrice
  })

  return {
    totalOrgs: totalOrgs || 0,
    orgsThisMonth: orgsThisMonth || 0,
    totalUsers: totalUsers || 0,
    totalJobsites: totalJobsites || 0,
    activeTrials: activeTrials || 0,
    tierCounts,
    monthlyRevenueEstimate: Math.round(monthlyRevenueEstimate),
    recentOrgs: recentOrgs || [],
  }
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function getAllOrganizations({ search = '', tier = '', status = '' } = {}) {
  await requireAdmin()
  const supabase = getAdminClient()

  let query = supabase
    .from('organizations')
    .select(`
      id, name, slug, subscription_tier, subscription_status,
      trial_ends_at, created_at, custom_price_override,
      custom_admin_price, custom_seat_price, custom_price_notes,
      stripe_customer_id
    `)
    .order('created_at', { ascending: false })

  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
  if (tier) query = query.eq('subscription_tier', tier)
  if (status) query = query.eq('subscription_status', status)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function suspendOrganization(orgId) {
  await requireAdmin()
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ subscription_status: 'suspended' })
    .eq('id', orgId)
  if (error) throw error
  await logAuditEvent('org.suspended', orgId, 'organization', {})
}

export async function reactivateOrganization(orgId) {
  await requireAdmin()
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ subscription_status: 'active' })
    .eq('id', orgId)
  if (error) throw error
}

export async function updateOrgTier(orgId, newTier) {
  await requireAdmin()
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ subscription_tier: newTier })
    .eq('id', orgId)
  if (error) throw error
  await logAuditEvent('org.tier_changed', orgId, 'organization', { new_tier: newTier })
}

// ─── Custom / Enterprise Pricing ─────────────────────────────────────────────

export async function setCustomPrice(orgId, adminPrice, seatPrice, notes = '') {
  await requireAdmin()
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      custom_price_override: true,
      custom_admin_price: adminPrice,
      custom_seat_price: seatPrice,
      custom_price_notes: notes,
    })
    .eq('id', orgId)
  if (error) throw error
  await logAuditEvent('org.enterprise_pricing_set', orgId, 'organization', {
    admin_price: adminPrice,
    seat_price: seatPrice,
    notes,
  })
}

export async function clearCustomPrice(orgId) {
  await requireAdmin()
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      custom_price_override: false,
      custom_admin_price: null,
      custom_seat_price: null,
      custom_price_notes: null,
    })
    .eq('id', orgId)
  if (error) throw error
}

export async function getEnterpriseOrgs() {
  await requireAdmin()
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, subscription_tier, subscription_status, custom_admin_price, custom_seat_price, custom_price_notes, created_at')
    .eq('custom_price_override', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ─── Discount Codes ───────────────────────────────────────────────────────────

export async function getDiscountCodes() {
  await requireAdmin()
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('discount_codes')
    .select('id, code, discount_percent, max_uses, used_count, expires_at, enabled, created_at, updated_at, duration_type, duration_months, stripe_coupon_id, stripe_promotion_code_id, applies_to_tier')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createDiscountCode({ code, discountPercent, maxUses, expiresAt }) {
  await requireAdmin()
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      code: code.toUpperCase().trim(),
      discount_percent: discountPercent,
      max_uses: maxUses || null,
      used_count: 0,
      expires_at: expiresAt || null,
      enabled: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleDiscountCode(codeId, enabled) {
  await requireAdmin()
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('discount_codes')
    .update({ enabled })
    .eq('id', codeId)
  if (error) throw error
  await logAuditEvent('discount_code.toggled', codeId, 'discount_code', { enabled })
}

export async function deleteDiscountCode(codeId) {
  await requireAdmin()
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('discount_codes')
    .delete()
    .eq('id', codeId)
  if (error) throw error
  await logAuditEvent('discount_code.deleted', codeId, 'discount_code', {})
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalyticsData() {
  await requireAdmin()
  const supabase = getAdminClient()

  // Last 12 months of snapshots
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
  twelveMonthsAgo.setDate(1)
  twelveMonthsAgo.setHours(0, 0, 0, 0)

  const { data: snapshots, error } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .gte('snapshot_date', twelveMonthsAgo.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })

  if (error) throw error

  // Also get monthly new org counts by querying organizations
  const { data: orgsTimeline, error: orgErr } = await supabase
    .from('organizations')
    .select('created_at, subscription_tier, subscription_status')
    .gte('created_at', twelveMonthsAgo.toISOString())
    .order('created_at', { ascending: true })

  if (orgErr) throw orgErr

  // Build monthly buckets
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    months.push({
      label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth(),
      newOrgs: 0,
      cancellations: 0,
    })
  }

  ;(orgsTimeline || []).forEach(org => {
    const d = new Date(org.created_at)
    const bucket = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth())
    if (bucket) bucket.newOrgs++
  })

  // Tier distribution from current active orgs
  const { data: tierDist } = await supabase
    .from('organizations')
    .select('subscription_tier, subscription_status')
    .in('subscription_status', ['active', 'trialing'])

  const tierCounts = { capture_i: 0, intelligence_ii: 0, command_iii: 0 }
  ;(tierDist || []).forEach(o => {
    tierCounts[o.subscription_tier || 'capture_i']++
  })

  // Trial conversion: trials that became active
  const { count: totalTrials } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })

  const { count: activePaid } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_status', 'active')

  const { count: cancelled } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .in('subscription_status', ['cancelled', 'canceled'])

  return {
    months,
    tierCounts,
    totalTrials: totalTrials || 0,
    activePaid: activePaid || 0,
    cancelled: cancelled || 0,
    snapshots: snapshots || [],
  }
}
