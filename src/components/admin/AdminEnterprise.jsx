/**
 * AdminEnterprise.jsx
 * Full enterprise pricing + contract management system.
 * Tables: enterprise_pricing_profiles, enterprise_pricing_audit_logs
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { adminFrom, adminInsert, adminUpdate, adminDelete } from '../../lib/adminFetch'
import { supabase } from '../../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS = [
  { id: 'capture_i',       label: 'Capture I',      color: '#2563eb', adminPrice: 39, seatPrice: 29 },
  { id: 'intelligence_ii', label: 'Intelligence II', color: '#06b6d4', adminPrice: 59, seatPrice: 29 },
  { id: 'command_iii',     label: 'Command III',     color: '#7c3aed', adminPrice: 79, seatPrice: 29 },
]

const TIER_MAP = Object.fromEntries(TIERS.map(t => [t.id, t]))

const STATUS_META = {
  active:   { label: 'Active',   color: '#22c55e' },
  draft:    { label: 'Draft',    color: '#3b82f6' },
  archived: { label: 'Archived', color: '#6b7280' },
  expired:  { label: 'Expired',  color: '#ef4444' },
}

const BILLING_FREQ = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual',  label: 'Annual'  },
]

const DISCOUNT_TYPES = [
  { id: 'none',    label: 'No discount' },
  { id: 'flat',    label: 'Flat ($)'    },
  { id: 'percent', label: 'Percent (%)'  },
]

const PAGE_SIZE = 10

// Warn thresholds (pricing below these triggers a low-margin warning)
const WARN_ADMIN_BELOW = 25
const WARN_SEAT_BELOW  = 8

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  // Layout
  root: { fontFamily: "'Inter', sans-serif", color: '#e2e8f0' },
  split: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' },
  card: { background: '#0c1018', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 },
  cardHead: { padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .7 },
  section: { padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.05)' },
  sectionLabel: { fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
  divider: { borderTop: '1px solid rgba(255,255,255,.05)', margin: '2px 0' },

  // KPI
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 },
  kpiCard: { background: '#0c1018', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '16px 18px' },
  kpiVal: (c) => ({ fontSize: 26, fontWeight: 800, color: c, lineHeight: 1, marginBottom: 3 }),
  kpiLabel: { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: .8 },
  kpiSub: { fontSize: 11, color: '#334155', marginTop: 4 },

  // Table
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '8px 12px', color: '#475569', fontWeight: 700, fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,.06)', background: '#080d14', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' },
  td: { padding: '9px 12px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle' },
  trHover: { cursor: 'pointer', transition: 'background .1s' },

  // Filters
  filterBar: { display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: '#e2e8f0', padding: '6px 11px', fontSize: 12, outline: 'none', width: 200, fontFamily: 'Inter,sans-serif' },
  filterSelect: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: '#94a3b8', padding: '5px 9px', fontSize: 12, outline: 'none', fontFamily: 'Inter,sans-serif' },

  // Form elements
  label: { fontSize: 10, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 700, letterSpacing: .7, textTransform: 'uppercase' },
  input: { background: '#0a0e16', border: '1px solid #1e2a3a', borderRadius: 7, color: '#e8e8e8', padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' },
  select: { background: '#0a0e16', border: '1px solid #1e2a3a', borderRadius: 7, color: '#e8e8e8', padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' },
  textarea: { background: '#0a0e16', border: '1px solid #1e2a3a', borderRadius: 7, color: '#e8e8e8', padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif', resize: 'vertical', minHeight: 64 },
  fGroup: { marginBottom: 11 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#94a3b8', marginBottom: 8, cursor: 'pointer' },

  // Buttons
  btn: { background: 'rgba(37,99,235,.15)', border: '1px solid rgba(37,99,235,.3)', color: '#60a5fa', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter,sans-serif' },
  greenBtn: { background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: '#4ade80', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter,sans-serif' },
  redBtn: { background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter,sans-serif' },
  grayBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: '#64748b', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 14, padding: '2px 5px', fontFamily: 'Inter,sans-serif' },

  // Badges
  badge: (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${c}20`, color: c, border: `1px solid ${c}40` }),
  warnBadge: { display: 'inline-block', padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.3)' },

  // Dropdown
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#0f1521', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.5)' },
  dropItem: (hover) => ({ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#94a3b8', background: hover ? 'rgba(59,130,246,.08)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,.04)' }),

  // Misc
  mono: { fontFamily: 'monospace', fontWeight: 700 },
  muted: { fontSize: 11, color: '#334155' },
  warn: { background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 7, padding: '9px 12px', fontSize: 12, color: '#fbbf24', marginBottom: 10 },
  err: { background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, padding: '9px 12px', fontSize: 12, color: '#f87171', marginBottom: 10 },
  ok: { background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, padding: '9px 12px', fontSize: 12, color: '#4ade80', marginBottom: 10 },
  emptyState: { textAlign: 'center', padding: '40px 24px', color: '#334155' },
  pagination: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.05)', justifyContent: 'flex-end' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (v) => v != null ? `$${Number(v).toFixed(2)}` : '—'
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const daysUntil = (d) => d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null

function calcMRR(profile, org) {
  if (!profile) return 0
  const admins = org?.admin_count || 1
  const seats  = org?.seat_count  || 0
  let base = (admins * (profile.admin_price || 0)) + (seats * (profile.seat_price || 0))
  // Apply discount
  if (profile.discount_type === 'flat')    base = Math.max(0, base - (profile.discount_value || 0))
  if (profile.discount_type === 'percent') base = base * (1 - (profile.discount_value || 0) / 100)
  return Math.max(base, profile.minimum_monthly_fee || 0)
}

function discountVsStandard(profile, org) {
  const tier = TIER_MAP[org?.subscription_tier]
  if (!tier || !profile) return null
  const std = (org?.admin_count || 1) * tier.adminPrice + (org?.seat_count || 0) * tier.seatPrice
  const custom = calcMRR(profile, org)
  if (std <= 0) return null
  const pct = ((std - custom) / std * 100).toFixed(0)
  return { standard: std, custom, pct, saving: std - custom }
}

function renewalUrgency(d) {
  const days = daysUntil(d)
  if (days === null) return null
  if (days < 0)  return { label: 'Overdue', color: '#ef4444' }
  if (days <= 30) return { label: `${days}d`, color: '#ef4444' }
  if (days <= 60) return { label: `${days}d`, color: '#f97316' }
  if (days <= 90) return { label: `${days}d`, color: '#fbbf24' }
  return { label: `${days}d`, color: '#22c55e' }
}

function blankProfile(org) {
  const tier = TIER_MAP[org?.subscription_tier] || TIERS[2]
  return {
    organization_id:      org?.id || '',
    tier:                 org?.subscription_tier || 'command_iii',
    admin_price:          tier.adminPrice,
    seat_price:           tier.seatPrice,
    included_admins:      1,
    included_seats:       5,
    overage_admin_price:  tier.adminPrice,
    overage_seat_price:   tier.seatPrice,
    minimum_monthly_fee:  0,
    billing_frequency:    'monthly',
    currency:             'USD',
    discount_type:        'none',
    discount_value:       0,
    free_months:          0,
    waived_onboarding_fee:false,
    contract_term_months: 12,
    contract_signed:      false,
    contract_signed_date: '',
    renewal_date:         '',
    auto_renew:           true,
    pricing_locked:       false,
    effective_date:       '',
    end_date:             '',
    account_owner:        '',
    sales_owner:          '',
    support_owner:        '',
    internal_notes:       '',
    public_note:          '',
    reason_for_pricing:   '',
    status:               'draft',
  }
}

// ── OrgSearch dropdown ────────────────────────────────────────────────────────

function OrgSearch({ value, onSelect }) {
  const [query,    setQuery]    = useState(value?.name || '')
  const [results,  setResults]  = useState([])
  const [allOrgs,  setAllOrgs]  = useState([])
  const [show,     setShow]     = useState(false)
  const [hoverIdx, setHoverIdx] = useState(-1)

  useEffect(() => {
    adminFrom('organizations', 'select=id,name,slug,subscription_tier,subscription_status&order=name&limit=500')
      .then(d => { if (Array.isArray(d)) setAllOrgs(d) })
      .catch(() => {})
  }, [])

  useEffect(() => { setQuery(value?.name || '') }, [value])

  const filter = (q) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    const lq = q.toLowerCase()
    setResults(allOrgs.filter(o =>
      o.name?.toLowerCase().includes(lq) || o.slug?.toLowerCase().includes(lq)
    ).slice(0, 8))
    setShow(true)
  }

  const pick = (org) => {
    setQuery(org.name)
    setShow(false)
    setResults([])
    onSelect(org)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={S.input}
        value={query}
        onChange={e => filter(e.target.value)}
        onFocus={() => query && results.length && setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 160)}
        placeholder="Search org by name or slug…"
      />
      {show && results.length > 0 && (
        <div style={S.dropdown}>
          {results.map((o, i) => {
            const tier = TIER_MAP[o.subscription_tier]
            return (
              <div
                key={o.id}
                style={S.dropItem(i === hoverIdx)}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(-1)}
                onMouseDown={() => pick(o)}
              >
                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{o.name}</span>
                {o.slug && <span style={{ color: '#334155', marginLeft: 6 }}>/{o.slug}</span>}
                {tier && <span style={{ float: 'right', color: tier.color, fontSize: 10 }}>{tier.label}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

function KPIRow({ profiles, orgs }) {
  const active   = profiles.filter(p => p.status === 'active')
  const totalMRR = active.reduce((sum, p) => {
    const org = orgs.find(o => o.id === p.organization_id)
    return sum + calcMRR(p, org)
  }, 0)

  const now      = Date.now()
  const exp30    = active.filter(p => { const d = daysUntil(p.renewal_date); return d !== null && d >= 0 && d <= 30 })
  const exp60    = active.filter(p => { const d = daysUntil(p.renewal_date); return d !== null && d > 30 && d <= 60 })
  const exp90    = active.filter(p => { const d = daysUntil(p.renewal_date); return d !== null && d > 60 && d <= 90 })

  return (
    <div style={S.kpiGrid}>
      <div style={{ ...S.kpiCard, borderTop: '3px solid #3b82f6' }}>
        <div style={S.kpiVal('#3b82f6')}>{profiles.length}</div>
        <div style={S.kpiLabel}>Enterprise Orgs</div>
        <div style={S.kpiSub}>{active.length} active</div>
      </div>
      <div style={{ ...S.kpiCard, borderTop: '3px solid #22c55e' }}>
        <div style={S.kpiVal('#22c55e')}>${totalMRR.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        <div style={S.kpiLabel}>Total MRR</div>
        <div style={S.kpiSub}>from active contracts</div>
      </div>
      <div style={{ ...S.kpiCard, borderTop: '3px solid #7c3aed' }}>
        <div style={S.kpiVal('#c4b5fd')}>{active.filter(p => p.contract_signed).length}</div>
        <div style={S.kpiLabel}>Signed Contracts</div>
        <div style={S.kpiSub}>{active.filter(p => !p.contract_signed).length} unsigned</div>
      </div>
      <div style={{ ...S.kpiCard, borderTop: `3px solid ${exp30.length ? '#ef4444' : exp60.length ? '#f97316' : '#fbbf24'}` }}>
        <div style={S.kpiVal(exp30.length ? '#f87171' : exp60.length ? '#fb923c' : '#fbbf24')}>
          {exp30.length + exp60.length + exp90.length}
        </div>
        <div style={S.kpiLabel}>Expiring Soon</div>
        <div style={S.kpiSub}>{exp30.length} in 30d · {exp60.length} in 60d · {exp90.length} in 90d</div>
      </div>
    </div>
  )
}

// ── Pricing Form ──────────────────────────────────────────────────────────────

function PricingForm({ selectedOrg, existingProfile, orgs, onSaved, onCancel }) {
  const isNew = !existingProfile?.id
  const [form, setForm] = useState(() => {
    if (existingProfile) {
      return {
        ...blankProfile(selectedOrg),
        ...existingProfile,
        contract_signed_date: existingProfile.contract_signed_date?.slice(0, 10) || '',
        renewal_date:         existingProfile.renewal_date?.slice(0, 10) || '',
        effective_date:       existingProfile.effective_date?.slice(0, 10) || '',
        end_date:             existingProfile.end_date?.slice(0, 10) || '',
      }
    }
    return blankProfile(selectedOrg)
  })
  const [org, setOrg] = useState(selectedOrg || null)
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState(null) // { type: 'ok'|'err'|'warn', text }
  const [section, setSection] = useState('pricing') // active section accordion

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = (k, v) => setForm(f => ({ ...f, [k]: v === '' ? '' : Number(v) }))

  // When org changes, initialise with their tier pricing
  const handleOrgSelect = (o) => {
    setOrg(o)
    if (!existingProfile) {
      const tier = TIER_MAP[o.subscription_tier] || TIERS[2]
      setForm(f => ({ ...f, organization_id: o.id, tier: o.subscription_tier, admin_price: tier.adminPrice, seat_price: tier.seatPrice, overage_admin_price: tier.adminPrice, overage_seat_price: tier.seatPrice }))
    } else {
      setForm(f => ({ ...f, organization_id: o.id }))
    }
  }

  // Derived helpers
  const tier    = TIER_MAP[org?.subscription_tier]
  const mrr     = calcMRR(form, org)
  const disc    = discountVsStandard(form, org)
  const lowMargin = (form.admin_price > 0 && form.admin_price < WARN_ADMIN_BELOW) ||
                    (form.seat_price  > 0 && form.seat_price  < WARN_SEAT_BELOW)

  // Validate
  function validate() {
    if (!org) return 'Select an organization first.'
    if (form.admin_price < 0 || form.seat_price < 0) return 'Prices cannot be negative.'
    if (form.renewal_date && form.effective_date && new Date(form.renewal_date) < new Date(form.effective_date))
      return 'Renewal date cannot be before effective date.'
    if (form.end_date && form.effective_date && new Date(form.end_date) < new Date(form.effective_date))
      return 'End date cannot be before effective date.'
    return null
  }

  async function getChangedBy() {
    try { const { data: { user } } = await supabase.auth.getUser(); return user?.id || null } catch { return null }
  }

  async function doSave(activateAfter = false) {
    const err = validate()
    if (err) { setMsg({ type: 'err', text: err }); return }
    setSaving(true); setMsg(null)

    try {
      const now     = new Date().toISOString()
      const userId  = await getChangedBy()
      const payload = {
        organization_id:      org.id,
        tier:                 form.tier || org.subscription_tier,
        admin_price:          Number(form.admin_price)          || 0,
        seat_price:           Number(form.seat_price)           || 0,
        included_admins:      Number(form.included_admins)      || 1,
        included_seats:       Number(form.included_seats)       || 5,
        overage_admin_price:  Number(form.overage_admin_price)  || 0,
        overage_seat_price:   Number(form.overage_seat_price)   || 0,
        minimum_monthly_fee:  Number(form.minimum_monthly_fee)  || 0,
        billing_frequency:    form.billing_frequency,
        currency:             form.currency || 'USD',
        discount_type:        form.discount_type,
        discount_value:       Number(form.discount_value)       || 0,
        free_months:          Number(form.free_months)          || 0,
        waived_onboarding_fee:!!form.waived_onboarding_fee,
        contract_term_months: Number(form.contract_term_months) || 12,
        contract_signed:      !!form.contract_signed,
        contract_signed_date: form.contract_signed_date || null,
        renewal_date:         form.renewal_date || null,
        auto_renew:           !!form.auto_renew,
        pricing_locked:       !!form.pricing_locked,
        effective_date:       form.effective_date || null,
        end_date:             form.end_date       || null,
        account_owner:        form.account_owner  || null,
        sales_owner:          form.sales_owner    || null,
        support_owner:        form.support_owner  || null,
        internal_notes:       form.internal_notes || null,
        public_note:          form.public_note    || null,
        reason_for_pricing:   form.reason_for_pricing || null,
        status:               activateAfter ? 'active' : (form.status || 'draft'),
        updated_at:           now,
      }

      let profileId = existingProfile?.id
      let action    = 'updated'

      if (isNew) {
        const res = await adminInsert('enterprise_pricing_profiles', { ...payload, created_at: now })
        profileId = Array.isArray(res) ? res[0]?.id : res?.id
        action    = 'created'
      } else {
        await adminUpdate('enterprise_pricing_profiles', payload, `id=eq.${profileId}`)
        if (activateAfter) action = 'activated'
      }

      // Audit log
      if (profileId) {
        await adminInsert('enterprise_pricing_audit_logs', {
          pricing_profile_id: profileId,
          organization_id:    org.id,
          action,
          changes_json:       { billing_frequency: payload.billing_frequency, status: payload.status },
          new_values_json:    { admin_price: payload.admin_price, seat_price: payload.seat_price, renewal_date: payload.renewal_date },
          old_values_json:    existingProfile ? { admin_price: existingProfile.admin_price, seat_price: existingProfile.seat_price } : null,
          changed_by:         userId,
          changed_at:         now,
        }).catch(() => {})

        // Keep organizations table in sync for backward compat
        await adminUpdate('organizations', {
          custom_price_override: true,
          custom_admin_price:    payload.admin_price,
          custom_seat_price:     payload.seat_price,
          custom_price_notes:    payload.reason_for_pricing || payload.internal_notes,
        }, `id=eq.${org.id}`).catch(() => {})
      }

      setMsg({ type: 'ok', text: `✓ Profile ${action} for "${org.name}"` })
      onSaved()
    } catch (e) {
      console.error('PricingForm save error:', e)
      setMsg({ type: 'err', text: e.message || 'Save failed.' })
    }
    setSaving(false)
  }

  async function doArchive() {
    if (!existingProfile?.id) return
    if (!window.confirm(`Archive pricing profile for "${org?.name}"?`)) return
    setSaving(true)
    try {
      await adminUpdate('enterprise_pricing_profiles', { status: 'archived', updated_at: new Date().toISOString() }, `id=eq.${existingProfile.id}`)
      const userId = await getChangedBy()
      await adminInsert('enterprise_pricing_audit_logs', {
        pricing_profile_id: existingProfile.id, organization_id: org?.id,
        action: 'archived', changed_by: userId, changed_at: new Date().toISOString(),
      }).catch(() => {})
      setMsg({ type: 'ok', text: 'Profile archived.' })
      onSaved()
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
    setSaving(false)
  }

  async function doResetToStandard() {
    if (!org) return
    if (!window.confirm(`Reset "${org.name}" to standard ${tier?.label || 'tier'} pricing?`)) return
    setSaving(true)
    try {
      if (existingProfile?.id) {
        await adminUpdate('enterprise_pricing_profiles', { status: 'archived', updated_at: new Date().toISOString() }, `id=eq.${existingProfile.id}`)
      }
      await adminUpdate('organizations', { custom_price_override: false, custom_admin_price: null, custom_seat_price: null, custom_price_notes: null }, `id=eq.${org.id}`).catch(() => {})
      setMsg({ type: 'ok', text: `Reset to standard pricing for "${org.name}".` })
      onSaved()
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
    setSaving(false)
  }

  const Sec = ({ id, icon, title, children }) => {
    const open = section === id
    return (
      <div style={S.section}>
        <div style={{ ...S.sectionLabel, cursor: 'pointer' }} onClick={() => setSection(open ? null : id)}>
          <span>{icon}</span> {title}
          <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
        {open && children}
      </div>
    )
  }

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={S.cardHead}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
            {isNew ? '✦ New Enterprise Deal' : `✎ ${org?.name || 'Edit Profile'}`}
          </div>
          {org && <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>/{org.slug}</div>}
        </div>
        {onCancel && <button style={S.iconBtn} onClick={onCancel}>×</button>}
      </div>

      {/* Org selector (only for new) */}
      {isNew && (
        <div style={{ ...S.section }}>
          <div style={S.label}>Organization *</div>
          <OrgSearch value={org} onSelect={handleOrgSelect} />
          {org && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#3b82f6' }}>
              ✓ {org.name} · {TIER_MAP[org.subscription_tier]?.label || org.subscription_tier} · {org.subscription_status}
            </div>
          )}
        </div>
      )}

      {/* MRR Preview */}
      {org && (
        <div style={{ background: 'rgba(59,130,246,.06)', borderBottom: '1px solid rgba(59,130,246,.1)', padding: '10px 18px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: .7 }}>Est. MRR</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa', fontFamily: 'monospace' }}>${mrr.toFixed(2)}</div>
          </div>
          {disc && (
            <>
              <div>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: .7 }}>vs Standard</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: disc.pct > 0 ? '#f87171' : '#4ade80' }}>
                  {disc.pct > 0 ? `↓ ${disc.pct}% off` : 'at standard'} (std ${fmt$(disc.standard)})
                </div>
              </div>
            </>
          )}
          {lowMargin && <span style={S.warnBadge}>⚠ Low margin</span>}
        </div>
      )}

      {/* Warnings */}
      <div style={{ padding: msg ? '10px 18px 0' : 0 }}>
        {msg?.type === 'err'  && <div style={S.err}>{msg.text}</div>}
        {msg?.type === 'ok'   && <div style={S.ok}>{msg.text}</div>}
        {msg?.type === 'warn' && <div style={S.warn}>{msg.text}</div>}
      </div>

      {/* ── Section A: Pricing ── */}
      <Sec id="pricing" icon="💰" title="A · Pricing">
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Admin Price / mo</label>
            <input style={{ ...S.input, color: form.admin_price < WARN_ADMIN_BELOW && form.admin_price > 0 ? '#fbbf24' : '#e8e8e8' }}
              type="number" min={0} step={0.01} value={form.admin_price}
              onChange={e => num('admin_price', e.target.value)} />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Seat Price / mo</label>
            <input style={{ ...S.input, color: form.seat_price < WARN_SEAT_BELOW && form.seat_price > 0 ? '#fbbf24' : '#e8e8e8' }}
              type="number" min={0} step={0.01} value={form.seat_price}
              onChange={e => num('seat_price', e.target.value)} />
          </div>
        </div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Included Admins</label>
            <input style={S.input} type="number" min={0} value={form.included_admins} onChange={e => num('included_admins', e.target.value)} />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Included Seats</label>
            <input style={S.input} type="number" min={0} value={form.included_seats} onChange={e => num('included_seats', e.target.value)} />
          </div>
        </div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Overage Admin / mo</label>
            <input style={S.input} type="number" min={0} step={0.01} value={form.overage_admin_price} onChange={e => num('overage_admin_price', e.target.value)} />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Overage Seat / mo</label>
            <input style={S.input} type="number" min={0} step={0.01} value={form.overage_seat_price} onChange={e => num('overage_seat_price', e.target.value)} />
          </div>
        </div>
        <div style={S.grid3}>
          <div style={S.fGroup}>
            <label style={S.label}>Min Monthly Fee</label>
            <input style={S.input} type="number" min={0} step={0.01} value={form.minimum_monthly_fee} onChange={e => num('minimum_monthly_fee', e.target.value)} />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Billing</label>
            <select style={S.select} value={form.billing_frequency} onChange={e => set('billing_frequency', e.target.value)}>
              {BILLING_FREQ.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Currency</label>
            <select style={S.select} value={form.currency} onChange={e => set('currency', e.target.value)}>
              {['USD','CAD','GBP','EUR','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {/* Standard rates reference */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 7, padding: '8px 10px', fontSize: 11, color: '#334155', marginTop: 4 }}>
          <div style={{ fontWeight: 700, color: '#475569', marginBottom: 4 }}>Standard Rates</div>
          {TIERS.map(t => (
            <div key={t.id} style={{ color: org?.subscription_tier === t.id ? t.color : '#334155' }}>
              {t.label}: ${t.adminPrice}/admin · ${t.seatPrice}/seat
            </div>
          ))}
        </div>
      </Sec>

      {/* ── Section B: Contract ── */}
      <Sec id="contract" icon="📄" title="B · Contract">
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Term (months)</label>
            <input style={S.input} type="number" min={1} value={form.contract_term_months} onChange={e => num('contract_term_months', e.target.value)} />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Renewal Date</label>
            <input style={S.input} type="date" value={form.renewal_date} onChange={e => set('renewal_date', e.target.value)} />
          </div>
        </div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Effective Date</label>
            <input style={S.input} type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)} />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>End Date (optional)</label>
            <input style={S.input} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Signed Date</label>
          <input style={S.input} type="date" value={form.contract_signed_date} onChange={e => set('contract_signed_date', e.target.value)} />
        </div>
        <label style={S.checkRow}><input type="checkbox" checked={!!form.contract_signed} onChange={e => set('contract_signed', e.target.checked)} /> Contract signed</label>
        <label style={S.checkRow}><input type="checkbox" checked={!!form.auto_renew} onChange={e => set('auto_renew', e.target.checked)} /> Auto-renew</label>
        <label style={S.checkRow}><input type="checkbox" checked={!!form.pricing_locked} onChange={e => set('pricing_locked', e.target.checked)} /> Price locked for contract term</label>
      </Sec>

      {/* ── Section C: Discounts ── */}
      <Sec id="discounts" icon="🏷️" title="C · Discounts">
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Discount Type</label>
            <select style={S.select} value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
              {DISCOUNT_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          {form.discount_type !== 'none' && (
            <div style={S.fGroup}>
              <label style={S.label}>{form.discount_type === 'percent' ? 'Discount %' : 'Discount $'}</label>
              <input style={S.input} type="number" min={0} step={form.discount_type === 'percent' ? 1 : 0.01} value={form.discount_value} onChange={e => num('discount_value', e.target.value)} />
            </div>
          )}
        </div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Free Months</label>
            <input style={S.input} type="number" min={0} value={form.free_months} onChange={e => num('free_months', e.target.value)} />
          </div>
        </div>
        <label style={S.checkRow}><input type="checkbox" checked={!!form.waived_onboarding_fee} onChange={e => set('waived_onboarding_fee', e.target.checked)} /> Waived onboarding fee</label>
      </Sec>

      {/* ── Section D: Ownership ── */}
      <Sec id="ownership" icon="👤" title="D · Ownership">
        <div style={S.fGroup}>
          <label style={S.label}>Account Owner</label>
          <input style={S.input} value={form.account_owner} onChange={e => set('account_owner', e.target.value)} placeholder="Name or email" />
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Sales Owner</label>
          <input style={S.input} value={form.sales_owner} onChange={e => set('sales_owner', e.target.value)} placeholder="Name or email" />
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Support Owner</label>
          <input style={S.input} value={form.support_owner} onChange={e => set('support_owner', e.target.value)} placeholder="Name or email" />
        </div>
      </Sec>

      {/* ── Section E: Notes ── */}
      <Sec id="notes" icon="📝" title="E · Notes">
        <div style={S.fGroup}>
          <label style={S.label}>Reason for Custom Pricing</label>
          <input style={S.input} value={form.reason_for_pricing} onChange={e => set('reason_for_pricing', e.target.value)} placeholder="e.g. 2-year contract, 100-seat deal" />
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Internal Notes (admin only)</label>
          <textarea style={S.textarea} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} placeholder="Notes visible to admins only…" />
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Public Note</label>
          <textarea style={{ ...S.textarea, minHeight: 50 }} value={form.public_note} onChange={e => set('public_note', e.target.value)} placeholder="Shown to org owner…" />
        </div>
      </Sec>

      {/* ── Action buttons ── */}
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.greenBtn, flex: 1 }} onClick={() => doSave(true)} disabled={saving}>
            {saving ? '⏳' : '✓ Save & Activate'}
          </button>
          <button style={{ ...S.btn, flex: 1 }} onClick={() => doSave(false)} disabled={saving}>
            {saving ? '⏳' : 'Save Draft'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.grayBtn, flex: 1 }} onClick={doResetToStandard} disabled={saving}>
            ↩ Reset to Standard
          </button>
          {!isNew && (
            <button style={{ ...S.redBtn, flex: 1 }} onClick={doArchive} disabled={saving}>
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Enterprise Table ──────────────────────────────────────────────────────────

function EnterpriseTable({ profiles, orgs, loading, onSelect, selectedId }) {
  const [search,      setSearch]      = useState('')
  const [filterStatus,setFilterStatus]= useState('all')
  const [filterTier,  setFilterTier]  = useState('all')
  const [filterRenew, setFilterRenew] = useState('all') // all | 30 | 60 | 90
  const [sortKey,     setSortKey]     = useState('updated_at')
  const [sortDir,     setSortDir]     = useState('desc')
  const [page,        setPage]        = useState(1)

  // Enrich profiles with org data
  const enriched = profiles.map(p => ({
    ...p,
    _org: orgs.find(o => o.id === p.organization_id) || null,
  }))

  // Filter
  const filtered = enriched.filter(p => {
    const name = p._org?.name?.toLowerCase() || ''
    const slug = p._org?.slug?.toLowerCase() || ''
    if (search && !name.includes(search.toLowerCase()) && !slug.includes(search.toLowerCase())) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterTier   !== 'all' && p.tier   !== filterTier)   return false
    if (filterRenew  !== 'all') {
      const days = daysUntil(p.renewal_date)
      if (filterRenew === '30' && (days === null || days < 0 || days > 30))  return false
      if (filterRenew === '60' && (days === null || days < 0 || days > 60))  return false
      if (filterRenew === '90' && (days === null || days < 0 || days > 90))  return false
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let av, bv
    if (sortKey === 'name')         { av = a._org?.name || ''; bv = b._org?.name || '' }
    else if (sortKey === 'mrr')     { av = calcMRR(a, a._org); bv = calcMRR(b, b._org) }
    else if (sortKey === 'renewal') { av = a.renewal_date || ''; bv = b.renewal_date || '' }
    else                            { av = a.updated_at || '';   bv = b.updated_at || ''   }
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Paginate
  const total  = sorted.length
  const pages  = Math.ceil(total / PAGE_SIZE)
  const paged  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const sortCol = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const sortInd = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={S.card}>
      {/* Filter bar */}
      <div style={S.filterBar}>
        <input
          style={S.searchInput}
          placeholder="Search name or slug…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select style={S.filterSelect} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={S.filterSelect} value={filterTier} onChange={e => { setFilterTier(e.target.value); setPage(1) }}>
          <option value="all">All tiers</option>
          {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select style={S.filterSelect} value={filterRenew} onChange={e => { setFilterRenew(e.target.value); setPage(1) }}>
          <option value="all">Any renewal</option>
          <option value="30">Renewing in 30d</option>
          <option value="60">Renewing in 60d</option>
          <option value="90">Renewing in 90d</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#334155' }}>
          {total} result{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th} onClick={() => sortCol('name')}>Org{sortInd('name')}</th>
              <th style={S.th}>Tier</th>
              <th style={S.th}>Status</th>
              <th style={S.th} onClick={() => sortCol('mrr')}>MRR{sortInd('mrr')}</th>
              <th style={S.th}>Admin $</th>
              <th style={S.th}>Seat $</th>
              <th style={S.th}>Billing</th>
              <th style={S.th} onClick={() => sortCol('renewal')}>Renewal{sortInd('renewal')}</th>
              <th style={S.th}>Contract</th>
              <th style={S.th}>Signed</th>
              <th style={S.th} onClick={() => sortCol('updated_at')}>Updated{sortInd('updated_at')}</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={12} style={{ ...S.td, textAlign: 'center', color: '#334155', padding: 24 }}>Loading…</td></tr>
            )}
            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={12}>
                  <div style={S.emptyState}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>💎</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No enterprise deals yet</div>
                    <div style={{ fontSize: 12, color: '#334155' }}>Use the form to create your first enterprise deal</div>
                  </div>
                </td>
              </tr>
            )}
            {paged.map(p => {
              const tier   = TIER_MAP[p.tier] || TIER_MAP[p._org?.subscription_tier]
              const stat   = STATUS_META[p.status] || STATUS_META.draft
              const renew  = renewalUrgency(p.renewal_date)
              const mrr    = calcMRR(p, p._org)
              const isSelected = p.id === selectedId
              const lowM   = p.admin_price > 0 && p.admin_price < WARN_ADMIN_BELOW

              return (
                <tr
                  key={p.id}
                  style={{ ...S.trHover, background: isSelected ? 'rgba(59,130,246,.06)' : undefined }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  onClick={() => onSelect(p)}
                >
                  <td style={{ ...S.td, fontWeight: 600, color: '#e2e8f0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p._org?.name || '—'}
                    {lowM && <span style={{ ...S.warnBadge, marginLeft: 5 }}>⚠</span>}
                  </td>
                  <td style={S.td}>
                    {tier ? <span style={S.badge(tier.color)}>{tier.label}</span> : '—'}
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(stat.color)}>{stat.label}</span>
                  </td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa' }}>
                    ${mrr.toFixed(0)}
                  </td>
                  <td style={{ ...S.td, fontFamily: 'monospace', color: '#e2e8f0' }}>${p.admin_price}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', color: '#e2e8f0' }}>${p.seat_price}</td>
                  <td style={{ ...S.td, color: '#64748b' }}>{p.billing_frequency}</td>
                  <td style={{ ...S.td, color: renew?.color || '#64748b', fontWeight: renew ? 600 : 400 }}>
                    {p.renewal_date ? (renew ? `${fmtDate(p.renewal_date)} (${renew.label})` : fmtDate(p.renewal_date)) : '—'}
                  </td>
                  <td style={{ ...S.td, color: '#64748b' }}>{p.contract_term_months ? `${p.contract_term_months}mo` : '—'}</td>
                  <td style={S.td}>
                    {p.contract_signed
                      ? <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>
                      : <span style={{ color: '#334155', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ ...S.td, color: '#334155', fontSize: 11 }}>
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={S.td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ ...S.iconBtn, color: '#60a5fa' }} onClick={() => onSelect(p)} title="Edit">✎</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={S.pagination}>
          <span style={{ fontSize: 11, color: '#334155' }}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, total)} of {total}</span>
          <button style={{ ...S.grayBtn, padding: '3px 9px', fontSize: 11 }} onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>‹</button>
          <button style={{ ...S.grayBtn, padding: '3px 9px', fontSize: 11 }} onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages}>›</button>
        </div>
      )}
    </div>
  )
}

// ── Renewal Tracker ───────────────────────────────────────────────────────────

function RenewalTracker({ profiles, orgs, onRefresh }) {
  const [notes,   setNotes]   = useState({})
  const [editId,  setEditId]  = useState(null)
  const [noteVal, setNoteVal] = useState('')
  const [saving,  setSaving]  = useState(null)

  // Only show active profiles with a renewal date, sorted by closest first
  const upcoming = profiles
    .filter(p => p.status === 'active' && p.renewal_date)
    .map(p => ({ ...p, _org: orgs.find(o => o.id === p.organization_id), _days: daysUntil(p.renewal_date) }))
    .filter(p => p._days !== null && p._days <= 90)
    .sort((a, b) => a._days - b._days)

  const markReviewed = async (p) => {
    setSaving(p.id)
    try {
      await adminUpdate('enterprise_pricing_profiles', {
        internal_notes: (p.internal_notes ? p.internal_notes + '\n' : '') + `[Reviewed ${new Date().toLocaleDateString()}]`,
        updated_at: new Date().toISOString(),
      }, `id=eq.${p.id}`)
      onRefresh()
    } catch (e) { console.error(e) }
    setSaving(null)
  }

  const saveNote = async (p) => {
    setSaving(p.id)
    try {
      await adminUpdate('enterprise_pricing_profiles', {
        internal_notes: (p.internal_notes ? p.internal_notes + '\n' : '') + `[${new Date().toLocaleDateString()}] ${noteVal}`,
        updated_at: new Date().toISOString(),
      }, `id=eq.${p.id}`)
      setEditId(null); setNoteVal(''); onRefresh()
    } catch (e) { console.error(e) }
    setSaving(null)
  }

  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.cardTitle}>📅 Renewal Tracker — Next 90 Days ({upcoming.length})</div>
      </div>
      {upcoming.length === 0 ? (
        <div style={{ ...S.emptyState, padding: 24 }}>
          <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>✓ No renewals due in the next 90 days</div>
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Organization</th>
              <th style={S.th}>Renewal Date</th>
              <th style={S.th}>Days</th>
              <th style={S.th}>MRR</th>
              <th style={S.th}>Owner</th>
              <th style={S.th}>Signed</th>
              <th style={S.th}>Notes</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map(p => {
              const urg = renewalUrgency(p.renewal_date)
              const mrr = calcMRR(p, p._org)
              return (
                <React.Fragment key={p.id}>
                  <tr style={S.trHover}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ ...S.td, fontWeight: 600, color: '#e2e8f0' }}>{p._org?.name || '—'}</td>
                    <td style={{ ...S.td, color: urg?.color || '#64748b' }}>{fmtDate(p.renewal_date)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: urg?.color || '#64748b' }}>{p._days}d</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>${mrr.toFixed(0)}</td>
                    <td style={{ ...S.td, color: '#64748b' }}>{p.account_owner || '—'}</td>
                    <td style={S.td}>
                      {p.contract_signed ? <span style={{ color: '#22c55e' }}>✓</span> : <span style={{ color: '#ef4444' }}>✗</span>}
                    </td>
                    <td style={{ ...S.td, color: '#475569', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.internal_notes?.split('\n').slice(-1)[0] || '—'}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...S.grayBtn, fontSize: 11, padding: '3px 8px' }}
                          onClick={() => markReviewed(p)} disabled={saving === p.id}>
                          {saving === p.id ? '…' : '✓ Reviewed'}
                        </button>
                        <button style={{ ...S.btn, fontSize: 11, padding: '3px 8px' }}
                          onClick={() => { setEditId(p.id === editId ? null : p.id); setNoteVal('') }}>
                          + Note
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editId === p.id && (
                    <tr>
                      <td colSpan={8} style={{ ...S.td, paddingTop: 4, paddingBottom: 10, background: 'rgba(59,130,246,.04)' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input style={{ ...S.input, flex: 1 }} value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="Add a note…" />
                          <button style={{ ...S.greenBtn, padding: '5px 12px' }} onClick={() => saveNote(p)} disabled={!noteVal.trim() || saving === p.id}>Save</button>
                          <button style={{ ...S.grayBtn, padding: '5px 10px' }} onClick={() => setEditId(null)}>×</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminEnterprise() {
  const [profiles,   setProfiles]   = useState([])
  const [orgs,       setOrgs]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)  // profile being edited
  const [showNew,    setShowNew]    = useState(false)  // showing new deal form

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [profs, orgList] = await Promise.allSettled([
        adminFrom('enterprise_pricing_profiles', 'select=*&order=updated_at.desc'),
        adminFrom('organizations', 'select=id,name,slug,subscription_tier,subscription_status,admin_count,seat_count&order=name&limit=500'),
      ])
      if (profs.status === 'fulfilled'   && Array.isArray(profs.value))   setProfiles(profs.value)
      if (orgList.status === 'fulfilled' && Array.isArray(orgList.value)) setOrgs(orgList.value)
    } catch (e) {
      console.error('AdminEnterprise loadData error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSelectRow = (profile) => {
    if (selected?.id === profile.id) { setSelected(null); setShowNew(false); return }
    setSelected(profile)
    setShowNew(false)
  }

  const handleNew = () => {
    setSelected(null)
    setShowNew(true)
  }

  const handleSaved = () => {
    loadData()
    // Keep form open after save so user can see result
  }

  const handleDuplicate = () => {
    if (!selected) return
    setSelected(null)
    setShowNew(true)
    // The form will be blank for new org — user selects org then gets a copy
  }

  // Determine right-panel content
  const showForm = showNew || selected !== null
  const formOrg  = selected ? orgs.find(o => o.id === selected.organization_id) || null : null

  return (
    <div style={S.root}>
      {/* KPI row */}
      <KPIRow profiles={profiles} orgs={orgs} />

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <button style={{ ...S.greenBtn, fontWeight: 700 }} onClick={handleNew}>
          + New Enterprise Deal
        </button>
        {selected && (
          <>
            <button style={S.grayBtn} onClick={handleDuplicate}>⧉ Duplicate</button>
            <button style={S.grayBtn} onClick={() => { setSelected(null); setShowNew(false) }}>✕ Deselect</button>
          </>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button style={S.grayBtn} onClick={loadData}>↻ Refresh</button>
        </div>
      </div>

      {/* Main split layout */}
      <div style={showForm ? S.split : {}}>
        {/* Left: Table */}
        <div>
          <EnterpriseTable
            profiles={profiles}
            orgs={orgs}
            loading={loading}
            onSelect={handleSelectRow}
            selectedId={selected?.id}
          />
        </div>

        {/* Right: Form */}
        {showForm && (
          <div style={{ position: 'sticky', top: 20 }}>
            <PricingForm
              key={selected?.id || 'new'}
              selectedOrg={formOrg}
              existingProfile={selected || null}
              orgs={orgs}
              onSaved={handleSaved}
              onCancel={() => { setSelected(null); setShowNew(false) }}
            />
          </div>
        )}
      </div>

      {/* Renewal Tracker */}
      <RenewalTracker profiles={profiles} orgs={orgs} onRefresh={loadData} />
    </div>
  )
}
