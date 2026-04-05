/**
 * AdminDiscountCodes.jsx
 * Full coupon / promo code management system.
 * Extends existing discount_codes table. Stripe codes kept compatible.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { adminFrom, adminInsert, adminUpdate, adminDelete } from '../../lib/adminFetch'
import { supabase } from '../../lib/supabase'
import { getAccessToken } from '../../lib/supabase.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS = [
  { id: 'capture_i',       label: 'Capture I'       },
  { id: 'intelligence_ii', label: 'Intelligence II'  },
  { id: 'command_iii',     label: 'Command III'      },
]

const SCOPES = [
  { id: 'all',          label: 'All plans'       },
  { id: 'plan',         label: 'Specific plan'   },
  { id: 'organization', label: 'Specific org'    },
  { id: 'user',         label: 'Specific user'   },
]

const BLANK = {
  code: '', discount_type: 'percent', discount_value: '',
  duration_type: 'once', duration_months: '',
  applies_scope: 'all', applies_to_tier: 'all',
  max_uses: '', per_customer_limit: '1',
  starts_at: '', expires_at: '',
  minimum_purchase_amount: '', internal_notes: '', enabled: true,
}

// ── Styles (matching existing KrakenCam admin dark theme) ─────────────────────

const S = {
  layout: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' },
  card: { background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, overflow: 'hidden' },
  cardHead: { padding: '13px 18px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 13, fontWeight: 600, color: '#ccc' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 14px', color: '#8b9ab8', fontWeight: 600, fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', borderBottom: '1px solid #222', background: '#141414', whiteSpace: 'nowrap' },
  td: { padding: '9px 14px', color: '#ccc', borderBottom: '1px solid #1a1a1a', verticalAlign: 'middle' },
  label: { fontSize: 10, color: '#9aaabb', textTransform: 'uppercase', letterSpacing: .8, display: 'block', marginBottom: 4, fontWeight: 600 },
  input: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 7, color: '#e8e8e8', padding: '7px 11px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' },
  select: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 7, color: '#e8e8e8', padding: '7px 11px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer', fontFamily: 'Inter,sans-serif' },
  textarea: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 7, color: '#e8e8e8', padding: '7px 11px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 54, fontFamily: 'Inter,sans-serif' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  fGroup: { marginBottom: 10 },
  filterBar: { display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1e1e1e', flexWrap: 'wrap', alignItems: 'center' },
  filterInput: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, color: '#ccc', padding: '5px 10px', fontSize: 12, outline: 'none', width: 170 },
  filterSel: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, color: '#999', padding: '5px 8px', fontSize: 12, outline: 'none', cursor: 'pointer' },
  mono: { fontFamily: 'monospace', fontWeight: 700, color: '#00d4ff', letterSpacing: 1, fontSize: 13 },
  badge: (color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}33` }),
  btn: (c = '#00d4ff') => ({ background: `${c}18`, border: `1px solid ${c}33`, color: c, borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter,sans-serif' }),
  primaryBtn: { background: 'rgba(0,212,255,.12)', border: '1px solid rgba(0,212,255,.3)', color: '#00d4ff', borderRadius: 7, padding: '9px', fontSize: 13, cursor: 'pointer', fontWeight: 600, width: '100%', fontFamily: 'Inter,sans-serif' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 },
  kpiCard: { background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '14px 16px' },
  kpiVal: (c) => ({ fontSize: 24, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 3 }),
  kpiLabel: { fontSize: 10, color: '#8b9ab8', textTransform: 'uppercase', letterSpacing: .8 },
  empty: { textAlign: 'center', padding: '32px', color: '#7a8a9a', fontSize: 13 },
  err: { color: '#ff6b6b', fontSize: 12, marginTop: 4 },
  ok: { color: '#4ec9b0', fontSize: 12, marginTop: 4 },
  section: { padding: '12px 16px', borderBottom: '1px solid #1e1e1e' },
  secLabel: { fontSize: 10, fontWeight: 700, color: '#8b9ab8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#161616', border: '1px solid #2a2a2a', borderRadius: 14, padding: '24px 22px', width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' },
  toast: (ok) => ({ position: 'fixed', bottom: 24, right: 24, background: ok ? '#0d2218' : '#1f0a0a', border: `1px solid ${ok ? '#1a5c38' : '#5c1a1a'}`, color: ok ? '#4ade80' : '#f87171', borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 600, zIndex: 99999, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }),
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(d) { return d && new Date(d) < new Date() }
function isScheduled(d) { return d && new Date(d) > new Date() }

function fmtDiscount(code) {
  const type  = code.discount_type || 'percent'
  const value = code.discount_value ?? code.discount_percent ?? 0
  return type === 'percent' ? `${value}%` : `$${Number(value).toFixed(2)}`
}

function fmtDuration(code) {
  if (code.duration_type === 'forever')   return 'Forever'
  if (code.duration_type === 'repeating') return code.duration_months ? `${code.duration_months}mo` : 'Repeating'
  return 'Once'
}

function fmtScope(code) {
  const scope = code.applies_scope || 'all'
  if (scope === 'all')          return 'All plans'
  if (scope === 'plan')         return TIERS.find(t => t.id === code.applies_to_tier)?.label || code.applies_to_tier || 'Plan'
  if (scope === 'organization') return 'Specific org'
  if (scope === 'user')         return 'Specific user'
  return scope
}

function codeStatus(code) {
  if (code.is_archived)                 return { label: 'Archived', color: '#6b7280' }
  if (!code.enabled)                    return { label: 'Disabled', color: '#ff6b6b' }
  if (isExpired(code.expires_at))       return { label: 'Expired',  color: '#f97316' }
  if (isScheduled(code.starts_at))      return { label: 'Scheduled',color: '#60a5fa' }
  const maxed = code.max_uses && code.used_count >= code.max_uses
  if (maxed)                            return { label: 'Maxed',    color: '#f97316' }
  return { label: 'Active', color: '#4ec9b0' }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, ok, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  return <div style={S.toast(ok)}>{msg}</div>
}

// ── Redemptions Modal ─────────────────────────────────────────────────────────

function RedemptionsModal({ code, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    adminFrom('discount_redemptions',
      `select=*,profiles(email),organizations(name)&discount_code_id=eq.${code.id}&order=redeemed_at.desc&limit=50`
    ).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [code.id])

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8e8' }}>
            Usage — <span style={S.mono}>{code.code}</span>
          </div>
          <button style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20 }} onClick={onClose}>×</button>
        </div>
        {loading ? (
          <div style={{ color: '#666', fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={S.empty}>No redemptions recorded yet.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>User</th>
                <th style={S.th}>Org</th>
                <th style={S.th}>Amount off</th>
                <th style={S.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...S.td, fontSize: 12 }}>{r.profiles?.email || r.user_id || '—'}</td>
                  <td style={{ ...S.td, fontSize: 12 }}>{r.organizations?.name || '—'}</td>
                  <td style={{ ...S.td, color: '#fbbf24', fontFamily: 'monospace' }}>
                    {r.discount_amount_applied != null ? `$${Number(r.discount_amount_applied).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ ...S.td, fontSize: 11, color: '#888' }}>
                    {r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button style={{ ...S.btn('#888'), padding: '6px 14px' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Code Form (right panel) ───────────────────────────────────────────────────

function CodeForm({ editCode, onSaved, onCancel }) {
  const isEdit = !!editCode?.id
  const [form, setForm] = useState(() => isEdit ? {
    code:                   editCode.code || '',
    discount_type:          editCode.discount_type || (editCode.discount_percent ? 'percent' : 'percent'),
    discount_value:         String(editCode.discount_value ?? editCode.discount_percent ?? ''),
    duration_type:          editCode.duration_type || 'once',
    duration_months:        String(editCode.duration_months || ''),
    applies_scope:          editCode.applies_scope || 'all',
    applies_to_tier:        editCode.applies_to_tier || 'all',
    max_uses:               String(editCode.max_uses || ''),
    per_customer_limit:     String(editCode.per_customer_limit ?? 1),
    starts_at:              editCode.starts_at ? editCode.starts_at.slice(0, 10) : '',
    expires_at:             editCode.expires_at ? editCode.expires_at.slice(0, 10) : '',
    minimum_purchase_amount:String(editCode.minimum_purchase_amount || ''),
    internal_notes:         editCode.internal_notes || '',
    enabled:                editCode.enabled !== false,
  } : { ...BLANK })

  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const [ok,     setOk]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function validate() {
    if (!form.code.trim())        return 'Code is required.'
    if (!form.discount_value)     return 'Discount value is required.'
    const val = parseFloat(form.discount_value)
    if (isNaN(val) || val < 0)    return 'Discount value must be ≥ 0.'
    if (form.discount_type === 'percent' && val > 100) return 'Percent discount cannot exceed 100.'
    if (form.duration_type === 'repeating' && (!form.duration_months || parseInt(form.duration_months) < 1))
      return 'Duration months required for repeating discount.'
    if (form.expires_at && form.starts_at && new Date(form.expires_at) <= new Date(form.starts_at))
      return 'Expiry cannot be before or equal to start date.'
    return null
  }

  async function getCreatedBy() {
    try { const { data: { user } } = await supabase.auth.getUser(); return user?.id || null } catch { return null }
  }

  const save = async () => {
    const valErr = validate()
    if (valErr) { setErr(valErr); return }
    setSaving(true); setErr(''); setOk('')
    try {
      const now = new Date().toISOString()
      const payload = {
        code:               form.code.trim().toUpperCase(),
        discount_type:      form.discount_type,
        discount_value:     parseFloat(form.discount_value),
        discount_percent:   form.discount_type === 'percent' ? parseFloat(form.discount_value) : null,
        duration_type:      form.duration_type,
        duration_months:    form.duration_type === 'repeating' ? parseInt(form.duration_months) : null,
        applies_scope:      form.applies_scope,
        applies_to_tier:    form.applies_scope === 'plan' ? form.applies_to_tier : 'all',
        max_uses:           form.max_uses ? parseInt(form.max_uses) : null,
        per_customer_limit: form.per_customer_limit ? parseInt(form.per_customer_limit) : 1,
        starts_at:          form.starts_at || null,
        expires_at:         form.expires_at || null,
        minimum_purchase_amount: form.minimum_purchase_amount ? parseFloat(form.minimum_purchase_amount) : null,
        internal_notes:     form.internal_notes || null,
        enabled:            form.enabled,
        updated_at:         now,
      }
      if (isEdit) {
        await adminUpdate('discount_codes', payload, `id=eq.${editCode.id}`)
        setOk('Code updated.')
      } else {
        const userId = await getCreatedBy()
        await adminInsert('discount_codes', { ...payload, created_at: now, used_count: 0, created_by: userId })
        setOk(`Code "${payload.code}" created.`)
        setForm({ ...BLANK })
      }
      onSaved()
    } catch (e) {
      console.error('CodeForm save error:', e)
      setErr(e.message || 'Save failed.')
    }
    setSaving(false)
  }

  const genCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const rand  = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    set('code', rand)
  }

  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={{ ...S.cardTitle, color: isEdit ? '#00d4ff' : '#ccc' }}>
          {isEdit ? `✎ Edit — ${editCode.code}` : '+ New Discount Code'}
        </div>
        {onCancel && <button style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }} onClick={onCancel}>×</button>}
      </div>

      {err && <div style={{ padding: '8px 16px', background: 'rgba(255,107,107,.08)', borderBottom: '1px solid rgba(255,107,107,.15)', ...S.err }}>{err}</div>}
      {ok  && <div style={{ padding: '8px 16px', background: 'rgba(78,201,176,.06)', borderBottom: '1px solid rgba(78,201,176,.15)', ...S.ok }}>✓ {ok}</div>}

      <div style={S.section}>
        <div style={S.secLabel}>Code</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...S.input, textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 1.5, flex: 1 }}
            value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} maxLength={24} placeholder="LAUNCH30" />
          <button style={{ ...S.btn('#8b9ab8'), padding: '7px 10px', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={genCode}>Auto</button>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.secLabel}>Discount</div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Type</label>
            <select style={S.select} value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed ($)</option>
            </select>
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>{form.discount_type === 'percent' ? 'Percent off' : 'Amount off ($)'}</label>
            <input style={S.input} type="number" min={0} max={form.discount_type === 'percent' ? 100 : undefined} step={form.discount_type === 'percent' ? 1 : 0.01}
              value={form.discount_value} onChange={e => set('discount_value', e.target.value)} placeholder={form.discount_type === 'percent' ? '20' : '50.00'} />
          </div>
        </div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Duration</label>
            <select style={S.select} value={form.duration_type} onChange={e => set('duration_type', e.target.value)}>
              <option value="once">Once</option>
              <option value="repeating">Repeating (X months)</option>
              <option value="forever">Forever</option>
            </select>
          </div>
          {form.duration_type === 'repeating' && (
            <div style={S.fGroup}>
              <label style={S.label}>Months</label>
              <input style={S.input} type="number" min={1} max={24} value={form.duration_months} onChange={e => set('duration_months', e.target.value)} placeholder="3" />
            </div>
          )}
        </div>
      </div>

      <div style={S.section}>
        <div style={S.secLabel}>Applies To</div>
        <div style={S.fGroup}>
          <label style={S.label}>Scope</label>
          <select style={S.select} value={form.applies_scope} onChange={e => set('applies_scope', e.target.value)}>
            {SCOPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        {form.applies_scope === 'plan' && (
          <div style={S.fGroup}>
            <label style={S.label}>Plan</label>
            <select style={S.select} value={form.applies_to_tier} onChange={e => set('applies_to_tier', e.target.value)}>
              {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.secLabel}>Limits</div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Max uses (blank = ∞)</label>
            <input style={S.input} type="number" min={1} value={form.max_uses} onChange={e => set('max_uses', e.target.value)} placeholder="100" />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Per customer</label>
            <input style={S.input} type="number" min={1} value={form.per_customer_limit} onChange={e => set('per_customer_limit', e.target.value)} placeholder="1" />
          </div>
        </div>
        <div style={S.grid2}>
          <div style={S.fGroup}>
            <label style={S.label}>Starts at (optional)</label>
            <input style={S.input} type="date" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} />
          </div>
          <div style={S.fGroup}>
            <label style={S.label}>Expires at (optional)</label>
            <input style={S.input} type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
          </div>
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Min purchase ($, optional)</label>
          <input style={S.input} type="number" min={0} step={0.01} value={form.minimum_purchase_amount} onChange={e => set('minimum_purchase_amount', e.target.value)} placeholder="e.g. 29.00" />
        </div>
      </div>

      <div style={S.section}>
        <div style={S.fGroup}>
          <label style={S.label}>Internal notes</label>
          <textarea style={S.textarea} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} placeholder="e.g. Partner promo — expires end of Q2" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
          Active (code is redeemable)
        </label>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        {onCancel && <button style={{ ...S.btn('#666'), flex: 1, padding: '8px' }} onClick={onCancel}>Cancel</button>}
        <button style={{ ...S.primaryBtn, flex: 2 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? '✓ Save Changes' : '+ Create Code'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminDiscountCodes() {
  const [codes,      setCodes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editCode,   setEditCode]   = useState(null)  // null = show create, obj = show edit
  const [showNew,    setShowNew]    = useState(false)
  const [viewUsage,  setViewUsage]  = useState(null)
  const [toast,      setToast]      = useState(null)  // { msg, ok }
  const [search,     setSearch]     = useState('')
  const [filterStat, setFilterStat] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFrom('discount_codes', 'select=*&order=created_at.desc')
      setCodes(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('AdminDiscountCodes load error:', e)
      setCodes([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Filter
  const filtered = codes.filter(c => {
    const q = search.toLowerCase()
    if (q && !c.code?.toLowerCase().includes(q)) return false
    if (filterType !== 'all' && (c.discount_type || 'percent') !== filterType) return false
    if (filterStat !== 'all') {
      const st = codeStatus(c).label.toLowerCase()
      if (filterStat === 'active'   && st !== 'active')   return false
      if (filterStat === 'inactive' && !['disabled','maxed'].includes(st)) return false
      if (filterStat === 'expired'  && st !== 'expired')  return false
      if (filterStat === 'archived' && st !== 'archived') return false
      if (filterStat === 'scheduled'&& st !== 'scheduled')return false
    }
    return true
  })

  // KPIs
  const active    = codes.filter(c => codeStatus(c).label === 'Active').length
  const expired   = codes.filter(c => codeStatus(c).label === 'Expired').length
  const scheduled = codes.filter(c => codeStatus(c).label === 'Scheduled').length
  const totalUses = codes.reduce((s, c) => s + (c.used_count || 0), 0)

  const copyCode = (code) => {
    navigator.clipboard.writeText(code.code).then(() => showToast(`Copied "${code.code}"`))
  }

  const toggleCode = async (code) => {
    try {
      await adminUpdate('discount_codes', { enabled: !code.enabled, updated_at: new Date().toISOString() }, `id=eq.${code.id}`)
      showToast(code.enabled ? 'Code disabled.' : 'Code enabled.')
      load()
    } catch (e) { showToast('Error: ' + e.message, false) }
  }

  const archiveCode = async (code) => {
    try {
      await adminUpdate('discount_codes', { is_archived: !code.is_archived, updated_at: new Date().toISOString() }, `id=eq.${code.id}`)
      showToast(code.is_archived ? 'Unarchived.' : 'Archived.')
      load()
    } catch (e) { showToast('Error: ' + e.message, false) }
  }

  const deleteCode = async (code) => {
    if ((code.used_count || 0) > 0) {
      showToast('Cannot delete a code that has been used. Archive it instead.', false); return
    }
    if (!window.confirm(`Delete code "${code.code}"? This cannot be undone.`)) return
    try {
      if (code.stripe_coupon_id) {
        // Try Stripe delete
        try {
          const token = await getAccessToken()
          await fetch('/api/delete-discount-code', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ codeId: code.id, stripeCouponId: code.stripe_coupon_id }) })
        } catch { /* continue */ }
      }
      await adminDelete('discount_codes', `id=eq.${code.id}`)
      showToast(`Deleted "${code.code}".`)
      load()
    } catch (e) { showToast('Error: ' + e.message, false) }
  }

  const duplicateCode = (code) => {
    const copy = { ...code, id: undefined, code: code.code + '_COPY', used_count: 0, created_at: undefined, updated_at: undefined, stripe_coupon_id: null, stripe_promotion_code_id: null }
    setEditCode(copy)
    setShowNew(true)
  }

  const onSaved = () => { load(); if (!editCode?.id) { /* keep open */ } }

  const showForm = showNew || editCode !== null

  return (
    <div>
      {/* Toast */}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}

      {/* KPI row */}
      <div style={S.kpiGrid}>
        {[
          { label: 'Active codes',    value: active,    color: '#4ec9b0' },
          { label: 'Total redemptions',value: totalUses, color: '#00d4ff' },
          { label: 'Scheduled',       value: scheduled, color: '#60a5fa' },
          { label: 'Expired',         value: expired,   color: '#f97316' },
        ].map(k => (
          <div key={k.label} style={{ ...S.kpiCard, borderTop: `3px solid ${k.color}` }}>
            <div style={S.kpiVal(k.color)}>{loading ? '…' : k.value}</div>
            <div style={S.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={showForm ? S.layout : {}}>
        {/* Left: table */}
        <div style={S.card}>
          <div style={S.cardHead}>
            <span style={S.cardTitle}>Discount Codes ({filtered.length})</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...S.btn('#8b9ab8'), padding: '5px 10px' }} onClick={load}>↻</button>
              <button style={{ ...S.btn('#4ec9b0'), padding: '5px 12px' }} onClick={() => { setEditCode(null); setShowNew(true) }}>+ New</button>
            </div>
          </div>

          {/* Filters */}
          <div style={S.filterBar}>
            <input style={S.filterInput} placeholder="Search code…" value={search} onChange={e => setSearch(e.target.value)} />
            <select style={S.filterSel} value={filterStat} onChange={e => setFilterStat(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="inactive">Disabled / Maxed</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>
            <select style={S.filterSel} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All types</option>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Code</th>
                  <th style={S.th}>Discount</th>
                  <th style={S.th}>Duration</th>
                  <th style={S.th}>Scope</th>
                  <th style={S.th}>Uses</th>
                  <th style={S.th}>Starts</th>
                  <th style={S.th}>Expires</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#7a8a9a' }}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={9}>
                    <div style={S.empty}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🎟️</div>
                      <div style={{ marginBottom: 4, fontWeight: 600, color: '#555' }}>No discount codes yet</div>
                      <div style={{ fontSize: 12 }}>Create a code to get started →</div>
                    </div>
                  </td></tr>
                )}
                {filtered.map(code => {
                  const stat   = codeStatus(code)
                  const maxed  = code.max_uses && code.used_count >= code.max_uses
                  return (
                    <tr key={code.id}
                      style={{ transition: 'background .1s', cursor: 'pointer', background: editCode?.id === code.id ? 'rgba(0,212,255,.04)' : undefined }}
                      onMouseEnter={e => { if (editCode?.id !== code.id) e.currentTarget.style.background = '#1e1e1e' }}
                      onMouseLeave={e => { if (editCode?.id !== code.id) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={S.td}>
                        <span style={S.mono}>{code.code}</span>
                        {code.stripe_coupon_id && <span style={{ marginLeft: 4, fontSize: 9, color: '#555', background: '#1a1a1a', border: '1px solid #333', padding: '1px 4px', borderRadius: 4 }}>Stripe</span>}
                      </td>
                      <td style={{ ...S.td, color: '#f0c040', fontWeight: 700, fontFamily: 'monospace' }}>{fmtDiscount(code)}</td>
                      <td style={{ ...S.td, color: '#aaa', fontSize: 11 }}>{fmtDuration(code)}</td>
                      <td style={{ ...S.td, color: '#aaa', fontSize: 11 }}>{fmtScope(code)}</td>
                      <td style={{ ...S.td, color: maxed ? '#f97316' : '#aaa', fontSize: 12, fontFamily: 'monospace' }}>
                        {code.used_count || 0}{code.max_uses ? `/${code.max_uses}` : ''}
                      </td>
                      <td style={{ ...S.td, fontSize: 11, color: '#888' }}>
                        {code.starts_at ? new Date(code.starts_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ ...S.td, fontSize: 11, color: isExpired(code.expires_at) ? '#f97316' : '#888' }}>
                        {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={S.td}><span style={S.badge(stat.color)}>{stat.label}</span></td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={{ ...S.btn('#00d4ff'), padding: '3px 8px' }} onClick={() => { setEditCode(code); setShowNew(false) }}>✎</button>
                          <button style={{ ...S.btn('#8b9ab8'), padding: '3px 8px' }} onClick={() => copyCode(code)} title="Copy code">⧉</button>
                          <button style={{ ...S.btn('#60a5fa'), padding: '3px 8px' }} onClick={() => setViewUsage(code)} title="View usage">📋</button>
                          <button style={{ ...S.btn(code.enabled ? '#ff6b6b' : '#4ec9b0'), padding: '3px 8px' }} onClick={() => toggleCode(code)}>{code.enabled ? 'Off' : 'On'}</button>
                          <button style={{ ...S.btn('#8b9ab8'), padding: '3px 8px' }} onClick={() => archiveCode(code)} title={code.is_archived ? 'Unarchive' : 'Archive'}>
                            {code.is_archived ? '↑' : '📁'}
                          </button>
                          <button style={{ ...S.btn('#f97316'), padding: '3px 8px' }} onClick={() => duplicateCode(code)} title="Duplicate">⊕</button>
                          <button style={{ ...S.btn('#ff6b6b'), padding: '3px 8px' }} onClick={() => deleteCode(code)} title="Delete">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: form */}
        {showForm && (
          <div style={{ position: 'sticky', top: 20 }}>
            <CodeForm
              key={editCode?.id || 'new'}
              editCode={editCode}
              onSaved={onSaved}
              onCancel={() => { setEditCode(null); setShowNew(false) }}
            />
          </div>
        )}
      </div>

      {/* Redemptions modal */}
      {viewUsage && <RedemptionsModal code={viewUsage} onClose={() => setViewUsage(null)} />}
    </div>
  )
}
