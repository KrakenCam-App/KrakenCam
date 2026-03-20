/**
 * AdminPricing.jsx
 *
 * Pricing Control Panel — super admin only.
 * Tab 1: New Customer Pricing — updates prices for new signups
 * Tab 2: Global Price Update — updates ALL active paying customers
 *
 * Colors:
 *   Capture I      → #2563eb (blue)
 *   Intelligence II → #06b6d4 (cyan)
 *   Command III    → #7c3aed (purple)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getPricingConfigRaw } from '../../lib/pricing'

// ── Tier metadata ─────────────────────────────────────────────────────────────

const TIERS = [
  { id: 'capture_i',      label: 'Capture I',      color: '#2563eb' },
  { id: 'intelligence_ii', label: 'Intelligence II', color: '#06b6d4' },
  { id: 'command_iii',    label: 'Command III',     color: '#7c3aed' },
]

const PERIODS = ['monthly', 'annual']
const PRICE_TYPES = ['admin', 'per_seat']

// Build a lookup key: tier|billing_period|price_type → row
function rowKey(tier, period, type) {
  return `${tier}|${period}|${type}`
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  container: {
    maxWidth: 900,
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    color: '#e8e8e8',
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 28,
    borderBottom: '1px solid #222',
  },
  tab: (active) => ({
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: active ? '#00d4ff' : '#777',
    borderBottom: active ? '2px solid #00d4ff' : '2px solid transparent',
    transition: 'all 0.15s',
    marginBottom: -1,
  }),
  warningBanner: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    color: '#fca5a5',
    fontSize: 13,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoBanner: {
    background: 'rgba(0,212,255,0.07)',
    border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    color: '#7ee7f8',
    fontSize: 13,
  },
  tierCard: (color) => ({
    background: '#1a1a1a',
    border: `1px solid ${color}33`,
    borderLeft: `3px solid ${color}`,
    borderRadius: 10,
    padding: '18px 20px',
    marginBottom: 16,
  }),
  tierTitle: (color) => ({
    fontSize: 15,
    fontWeight: 700,
    color,
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }),
  periodGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  periodSection: {
    background: '#111',
    borderRadius: 8,
    padding: '14px 16px',
  },
  periodLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#666',
    marginBottom: 10,
  },
  inputRow: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
    display: 'block',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    width: 80,
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#e8e8e8',
    fontSize: 14,
    fontWeight: 600,
    padding: '6px 10px',
    outline: 'none',
  },
  inputUnit: {
    fontSize: 11,
    color: '#555',
  },
  metaText: {
    fontSize: 10,
    color: '#444',
    marginTop: 2,
  },
  actionRow: {
    marginTop: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  confirmField: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  confirmInput: {
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#e8e8e8',
    fontSize: 13,
    padding: '7px 12px',
    outline: 'none',
    width: 140,
  },
  confirmHint: {
    fontSize: 11,
    color: '#666',
  },
  btn: (disabled, danger) => ({
    padding: '10px 22px',
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 8,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled
      ? '#333'
      : danger
        ? 'rgba(239,68,68,0.85)'
        : 'rgba(0,212,255,0.9)',
    color: disabled ? '#666' : '#fff',
    transition: 'all 0.15s',
    alignSelf: 'flex-start',
  }),
  successMsg: {
    marginTop: 12,
    padding: '10px 16px',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 8,
    color: '#86efac',
    fontSize: 13,
  },
  errorMsg: {
    marginTop: 12,
    padding: '10px 16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    color: '#fca5a5',
    fontSize: 13,
  },
  progressMsg: {
    marginTop: 12,
    color: '#00d4ff',
    fontSize: 13,
  },
  loadingMsg: {
    color: '#555',
    fontSize: 13,
    padding: '20px 0',
  },
}

// ── PriceInputGrid ────────────────────────────────────────────────────────────

function PriceInputGrid({ values, rawRows, onChange }) {
  return (
    <div>
      {TIERS.map(tier => (
        <div key={tier.id} style={S.tierCard(tier.color)}>
          <div style={S.tierTitle(tier.color)}>
            <span>●</span> {tier.label}
          </div>
          <div style={S.periodGrid}>
            {PERIODS.map(period => (
              <div key={period} style={S.periodSection}>
                <div style={S.periodLabel}>{period === 'monthly' ? 'Monthly' : 'Annual'}</div>
                {PRICE_TYPES.map(type => {
                  const key = rowKey(tier.id, period, type)
                  const rawRow = rawRows[key]
                  const val = values[key] ?? ''
                  return (
                    <div key={type} style={S.inputRow}>
                      <label style={S.inputLabel}>
                        {type === 'admin' ? 'Admin' : 'Per Seat'}
                      </label>
                      <div style={S.inputWrapper}>
                        <span style={{ color: '#666', fontSize: 13 }}>$</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={val}
                          onChange={e => onChange(key, e.target.value)}
                          style={S.input}
                        />
                        <span style={S.inputUnit}>
                          {period === 'annual' ? '/mo billed annually' : '/mo'}
                          {type === 'per_seat' ? ' /user' : ''}
                        </span>
                      </div>
                      {rawRow?.updated_at && (
                        <div style={S.metaText}>
                          Updated {new Date(rawRow.updated_at).toLocaleDateString()}
                          {rawRow.stripe_price_id && (
                            <span> · Stripe: {rawRow.stripe_price_id}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminPricing() {
  const [activeTab, setActiveTab] = useState('new_customers')
  const [rawRows, setRawRows] = useState({})        // key → DB row
  const [values, setValues] = useState({})           // key → string amount
  const [globalValues, setGlobalValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState(null)  // { type: 'success'|'error'|'progress', text }
  const [activeOrgCount, setActiveOrgCount] = useState(null)

  // Load pricing config from DB
  const loadPricing = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getPricingConfigRaw()
      const rowMap = {}
      const valMap = {}
      for (const row of rows) {
        const key = rowKey(row.tier, row.billing_period, row.price_type)
        rowMap[key] = row
        valMap[key] = String(row.amount)
      }
      setRawRows(rowMap)
      setValues(valMap)
      setGlobalValues({ ...valMap }) // start global tab with same values
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Failed to load pricing: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [])

  // Load active org count for global tab
  const loadActiveOrgs = useCallback(async () => {
    const { count } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active')
      .neq('plan_type', 'enterprise')
    setActiveOrgCount(count ?? 0)
  }, [])

  useEffect(() => {
    loadPricing()
    loadActiveOrgs()
  }, [loadPricing, loadActiveOrgs])

  function handleValueChange(valuesState, setValuesState, key, val) {
    setValuesState(prev => ({ ...prev, [key]: val }))
  }

  function buildPricesArray(valuesState) {
    const prices = []
    for (const tier of TIERS) {
      for (const period of PERIODS) {
        for (const type of PRICE_TYPES) {
          const key = rowKey(tier.id, period, type)
          const amount = parseFloat(valuesState[key])
          if (!isNaN(amount) && amount > 0) {
            prices.push({ tier: tier.id, billing_period: period, price_type: type, amount })
          }
        }
      }
    }
    return prices
  }

  async function handleSave(mode) {
    setSaving(true)
    setStatusMsg(null)

    const prices = buildPricesArray(mode === 'new_customers' ? values : globalValues)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (mode === 'all_customers') {
        setStatusMsg({ type: 'progress', text: `Updating ${activeOrgCount ?? 'all'} subscriptions…` })
      }

      const res = await fetch('/api/update-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode, prices }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unknown error')
      }

      if (mode === 'new_customers') {
        setStatusMsg({ type: 'success', text: '✓ Pricing updated! New signups will see these prices.' })
      } else {
        setStatusMsg({
          type: 'success',
          text: `✓ Updated ${data.updated_count} subscription${data.updated_count !== 1 ? 's' : ''} successfully.${!data.stripe_available ? ' (Stripe not configured — DB updated only)' : ''}`,
        })
      }
      setConfirmText('')
      await loadPricing()
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={S.loadingMsg}>Loading pricing configuration…</div>
  }

  return (
    <div style={S.container}>
      <div style={S.heading}>💰 Pricing Control</div>
      <div style={S.subheading}>Manage subscription pricing for new customers or all active customers.</div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button
          style={S.tab(activeTab === 'new_customers')}
          onClick={() => { setActiveTab('new_customers'); setStatusMsg(null) }}
        >
          New Customer Pricing
        </button>
        <button
          style={S.tab(activeTab === 'all_customers')}
          onClick={() => { setActiveTab('all_customers'); setStatusMsg(null) }}
        >
          ⚠️ Global Price Update
        </button>
      </div>

      {/* ── Tab 1: New Customer Pricing ── */}
      {activeTab === 'new_customers' && (
        <>
          <div style={S.infoBanner}>
            ℹ️ These prices apply to <strong>new signups only</strong>. Existing customers are not affected.
          </div>

          <PriceInputGrid
            values={values}
            rawRows={rawRows}
            onChange={(key, val) => handleValueChange(values, setValues, key, val)}
          />

          <div style={S.actionRow}>
            <button
              style={S.btn(saving, false)}
              disabled={saving}
              onClick={() => handleSave('new_customers')}
            >
              {saving ? 'Saving…' : 'Save New Customer Pricing'}
            </button>

            {statusMsg && (
              <div style={statusMsg.type === 'success' ? S.successMsg : statusMsg.type === 'progress' ? S.progressMsg : S.errorMsg}>
                {statusMsg.text}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab 2: Global Price Update ── */}
      {activeTab === 'all_customers' && (
        <>
          <div style={S.warningBanner}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <strong>Danger zone.</strong> This will update prices for <strong>ALL active paying customers</strong> immediately.
              Enterprise customers with custom pricing are excluded. This action cannot be undone.
              {activeOrgCount !== null && (
                <div style={{ marginTop: 4, color: '#f87171' }}>
                  Currently {activeOrgCount} active non-enterprise org{activeOrgCount !== 1 ? 's' : ''} would be affected.
                </div>
              )}
            </div>
          </div>

          <PriceInputGrid
            values={globalValues}
            rawRows={rawRows}
            onChange={(key, val) => handleValueChange(globalValues, setGlobalValues, key, val)}
          />

          <div style={S.actionRow}>
            <div style={S.confirmField}>
              <span style={S.confirmHint}>Type <strong>CONFIRM</strong> to enable the button:</span>
              <input
                type="text"
                placeholder="CONFIRM"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                style={S.confirmInput}
              />
            </div>

            <button
              style={S.btn(saving || confirmText !== 'CONFIRM', true)}
              disabled={saving || confirmText !== 'CONFIRM'}
              onClick={() => handleSave('all_customers')}
            >
              {saving ? 'Updating…' : 'Apply to All Customers'}
            </button>

            {statusMsg && (
              <div style={statusMsg.type === 'success' ? S.successMsg : statusMsg.type === 'progress' ? S.progressMsg : S.errorMsg}>
                {statusMsg.text}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
