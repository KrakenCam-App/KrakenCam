/**
 * AdminBilling.jsx
 * Revenue dashboard: MRR, ARR, churn, signups, failed payments,
 * upcoming renewals, at-risk trials, revenue by tier.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:14, marginBottom:28 },
  metaCard: { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'18px 20px', display:'flex', flexDirection:'column', gap:5 },
  metaLabel: { fontSize:11, color:'#555', fontWeight:600, letterSpacing:.8, textTransform:'uppercase' },
  metaValue: (color='#00d4ff') => ({ fontSize:30, fontWeight:700, color, lineHeight:1 }),
  metaSub: { fontSize:12, color:'#555', marginTop:2 },
  section: { marginBottom:28 },
  sectionTitle: { fontSize:14, fontWeight:600, color:'#ccc', marginBottom:12, letterSpacing:.3, display:'flex', alignItems:'center', gap:8 },
  card: { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, overflow:'hidden' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'9px 14px', background:'#111', color:'#555', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:.6, borderBottom:'1px solid #222' },
  td: { padding:'10px 14px', borderBottom:'1px solid #1e1e1e', color:'#ccc', verticalAlign:'middle' },
  badge: (color) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${color}22`, color, border:`1px solid ${color}44` }),
  empty: { textAlign:'center', padding:'32px', color:'#444', fontSize:13 },
  refreshBtn: { marginLeft:'auto', background:'transparent', border:'1px solid #333', borderRadius:7, color:'#888', padding:'6px 12px', fontSize:12, cursor:'pointer' },
  actionBtn: { background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.3)', color:'#60a5fa', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:600 },
  dangerBtn: { background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', color:'#f87171', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:600 },
}

const TIER_PRICES = {
  capture_i:       { monthly:39, annual:33 },
  intelligence_ii: { monthly:59, annual:50 },
  command_iii:     { monthly:79, annual:67 },
}
const TIER_LABEL = { capture_i:'Capture I', intelligence_ii:'Intelligence II', command_iii:'Command III' }
const TIER_COLOR = { capture_i:'#4ec9b0', intelligence_ii:'#00d4ff', command_iii:'#c792ea' }

function fmt$(n) { return '$' + (n||0).toLocaleString('en-US', { minimumFractionDigits:0 }) }
function fmtDate(s) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }
function daysUntil(s) { if (!s) return null; return Math.ceil((new Date(s)-Date.now())/(1000*60*60*24)) }

export default function AdminBilling() {
  const [orgs,        setOrgs]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [retrying,    setRetrying]    = useState({})
  const [tab,         setTab]         = useState('overview') // overview | failed | trials | revenue

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id,name,slug,subscription_tier,subscription_status,trial_ends_at,stripe_customer_id,stripe_subscription_id,created_at,custom_admin_price,custom_seat_price,custom_price_override')
        .order('created_at', { ascending: false })
      if (error) throw error
      setOrgs(data || [])
    } catch (e) {
      console.error('AdminBilling load error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived metrics ──
  const active   = orgs.filter(o => o.subscription_status === 'active')
  const trialing = orgs.filter(o => o.subscription_status === 'trialing')
  const failed   = orgs.filter(o => o.subscription_status === 'past_due' || o.subscription_status === 'unpaid')
  const cancelled = orgs.filter(o => o.subscription_status === 'cancelled' || o.subscription_status === 'canceled')

  // MRR: sum of active org base prices
  const mrr = active.reduce((sum, o) => {
    const prices = TIER_PRICES[o.subscription_tier] || { monthly:0, annual:0 }
    const base = o.custom_admin_price || ((o.subscription_tier === 'command_iii' ? 'annual' : 'monthly') === 'annual' ? prices.annual : prices.monthly)
    const seats = Math.max(0, ((o.custom_seat_price ? 2 : 1) || 1) - 1) // first seat included in base
    return sum + base + seats * ((o.subscription_tier === 'command_iii' ? 'annual' : 'monthly') === 'annual' ? 26 : 29)
  }, 0)

  const arr = mrr * 12

  // Churn: cancelled / (active + cancelled) last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString()
  const recentCancelled = cancelled.filter(o => o.updated_at > thirtyDaysAgo).length
  const churnRate = active.length > 0 ? ((recentCancelled / (active.length + recentCancelled)) * 100).toFixed(1) : '0.0'

  // Revenue by tier
  const byTier = ['capture_i','intelligence_ii','command_iii'].map(tier => {
    const tierOrgs = active.filter(o => o.subscription_tier === tier)
    const rev = tierOrgs.reduce((sum, o) => {
      const prices = TIER_PRICES[tier] || { monthly:0, annual:0 }
      const base = o.custom_admin_price || ((o.subscription_tier === 'command_iii' ? 'annual' : 'monthly') === 'annual' ? prices.annual : prices.monthly)
      return sum + base
    }, 0)
    return { tier, count: tierOrgs.length, rev }
  })

  // Upcoming renewals (next 7 days)
  const renewalsSoon = active.filter(o => {
    if (!o.trial_ends_at) return false
    const d = daysUntil(o.trial_ends_at)
    return d !== null && d >= 0 && d <= 7
  }).sort((a,b) => new Date(a.current_period_end) - new Date(b.current_period_end))

  // Trials ending in 7 days
  const trialsEndingSoon = trialing.filter(o => {
    if (!o.trial_ends_at) return false
    const d = daysUntil(o.trial_ends_at)
    return d !== null && d >= 0 && d <= 7
  }).sort((a,b) => new Date(a.trial_ends_at) - new Date(b.trial_ends_at))

  const retryPayment = async (org) => {
    setRetrying(r => ({ ...r, [org.id]: true }))
    try {
      // Log the retry attempt — actual Stripe retry would go through an edge function
      await supabase.from('audit_log').insert({
        admin_id: (await supabase.auth.getUser()).data?.user?.id,
        event_type: 'billing.payment_retry',
        target_org_id: org.id,
        details: { org_name: org.name, stripe_subscription_id: org.stripe_subscription_id }
      })
      alert(`Payment retry logged for ${org.name}.\n\nTo force a retry: go to Stripe Dashboard → Customers → ${org.name} → Subscriptions → Retry invoice.`)
    } catch (e) { console.error(e) }
    setRetrying(r => ({ ...r, [org.id]: false }))
  }

  const TABS = [
    { id:'overview', label:'📊 Overview' },
    { id:'failed',   label:`💳 Failed Payments${failed.length ? ` (${failed.length})` : ''}` },
    { id:'trials',   label:`⏳ Trials${trialsEndingSoon.length ? ` (${trialsEndingSoon.length} ending)` : ''}` },
    { id:'revenue',  label:'💰 Revenue by Tier' },
  ]

  if (loading) return <div style={{ color:'#555', fontSize:13, padding:20 }}>Loading billing data…</div>

  return (
    <div>
      {/* ── Metric cards ── */}
      <div style={S.grid}>
        {[
          { label:'MRR',          value:fmt$(mrr),          color:'#00d4ff', sub:'Monthly recurring revenue' },
          { label:'ARR',          value:fmt$(arr),          color:'#c792ea', sub:'Annual run rate' },
          { label:'Active orgs',  value:active.length,      color:'#4ec9b0', sub:`${trialing.length} trialing` },
          { label:'Churn (30d)',  value:`${churnRate}%`,    color: parseFloat(churnRate)>5 ? '#f87171' : '#4ec9b0', sub:'Cancelled of total' },
          { label:'Failed pmts',  value:failed.length,      color: failed.length ? '#f87171' : '#4ec9b0', sub:'Need attention' },
          { label:'Renewals (7d)',value:renewalsSoon.length, color:'#fbbf24', sub:'Next 7 days' },
        ].map(m => (
          <div key={m.label} style={S.metaCard}>
            <div style={S.metaLabel}>{m.label}</div>
            <div style={S.metaValue(m.color)}>{m.value}</div>
            <div style={S.metaSub}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #222', paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'8px 16px', background:'transparent', border:'none', borderBottom: tab===t.id ? '2px solid #00d4ff' : '2px solid transparent',
            color: tab===t.id ? '#00d4ff' : '#666', fontSize:13, fontWeight: tab===t.id ? 600 : 400, cursor:'pointer', marginBottom:-1,
          }}>{t.label}</button>
        ))}
        <button style={S.refreshBtn} onClick={load}>↻ Refresh</button>
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div style={S.section}>
          <div style={S.sectionTitle}>🔄 Upcoming Renewals (next 7 days)</div>
          <div style={S.card}>
            {renewalsSoon.length === 0
              ? <div style={S.empty}>No renewals in the next 7 days</div>
              : <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Organization</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Cycle</th>
                    <th style={S.th}>Renews</th>
                    <th style={S.th}>Days Left</th>
                  </tr></thead>
                  <tbody>
                    {renewalsSoon.map(o => (
                      <tr key={o.id}>
                        <td style={S.td}>{o.name}</td>
                        <td style={S.td}><span style={S.badge(TIER_COLOR[o.subscription_tier]||'#888')}>{TIER_LABEL[o.subscription_tier]||o.subscription_tier}</span></td>
                        <td style={S.td}>{(o.subscription_tier === 'command_iii' ? 'annual' : 'monthly') === 'annual' ? '📅 Annual' : '📆 Monthly'}</td>
                        <td style={S.td}>{fmtDate(o.trial_ends_at)}</td>
                        <td style={{ ...S.td, color:'#fbbf24', fontWeight:600 }}>{daysUntil(o.trial_ends_at)}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}

      {/* ── Failed payments tab ── */}
      {tab === 'failed' && (
        <div style={S.section}>
          <div style={S.sectionTitle}>💳 Failed / Past-Due Payments</div>
          <div style={S.card}>
            {failed.length === 0
              ? <div style={S.empty}>🎉 No failed payments</div>
              : <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Organization</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Since</th>
                    <th style={S.th}>Action</th>
                  </tr></thead>
                  <tbody>
                    {failed.map(o => (
                      <tr key={o.id}>
                        <td style={S.td}>{o.name}</td>
                        <td style={S.td}><span style={S.badge(TIER_COLOR[o.subscription_tier]||'#888')}>{TIER_LABEL[o.subscription_tier]||o.subscription_tier}</span></td>
                        <td style={S.td}><span style={S.badge('#f87171')}>{o.subscription_status}</span></td>
                        <td style={S.td}>{fmtDate(o.trial_ends_at)}</td>
                        <td style={S.td}>
                          <button style={S.actionBtn} disabled={retrying[o.id]} onClick={() => retryPayment(o)}>
                            {retrying[o.id] ? '⏳' : '↻ Retry'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
          <div style={{ fontSize:12, color:'#444', marginTop:10 }}>
            💡 Stripe automatically retries failed payments. Use the Retry button to log an attempt and get a direct link to Stripe Dashboard.
          </div>
        </div>
      )}

      {/* ── Trials tab ── */}
      {tab === 'trials' && (
        <div style={S.section}>
          <div style={S.sectionTitle}>⏳ Active Trials</div>
          <div style={S.card}>
            {trialing.length === 0
              ? <div style={S.empty}>No active trials</div>
              : <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Organization</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Trial Ends</th>
                    <th style={S.th}>Days Left</th>
                    <th style={S.th}>Status</th>
                  </tr></thead>
                  <tbody>
                    {trialing.sort((a,b) => new Date(a.trial_ends_at)-new Date(b.trial_ends_at)).map(o => {
                      const d = daysUntil(o.trial_ends_at)
                      const urgent = d !== null && d <= 3
                      const warning = d !== null && d <= 7
                      return (
                        <tr key={o.id}>
                          <td style={S.td}>{o.name}</td>
                          <td style={S.td}><span style={S.badge(TIER_COLOR[o.subscription_tier]||'#888')}>{TIER_LABEL[o.subscription_tier]||o.subscription_tier}</span></td>
                          <td style={S.td}>{fmtDate(o.trial_ends_at)}</td>
                          <td style={{ ...S.td, color: urgent ? '#f87171' : warning ? '#fbbf24' : '#4ec9b0', fontWeight:600 }}>
                            {d === null ? '—' : d <= 0 ? 'Expired' : `${d}d`}
                          </td>
                          <td style={S.td}>
                            <span style={S.badge(urgent ? '#f87171' : warning ? '#fbbf24' : '#4ec9b0')}>
                              {urgent ? '🔴 Ending soon' : warning ? '⚠️ This week' : '✅ Active'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}

      {/* ── Revenue by tier ── */}
      {tab === 'revenue' && (
        <div style={S.section}>
          <div style={S.sectionTitle}>💰 Revenue by Tier (Active orgs)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14, marginBottom:24 }}>
            {byTier.map(({ tier, count, rev }) => (
              <div key={tier} style={{ ...S.metaCard, borderTop:`3px solid ${TIER_COLOR[tier]||'#555'}` }}>
                <div style={{ fontSize:13, fontWeight:700, color: TIER_COLOR[tier]||'#888' }}>{TIER_LABEL[tier]}</div>
                <div style={{ fontSize:28, fontWeight:700, color:'#e8e8e8' }}>{fmt$(rev)}<span style={{ fontSize:13, color:'#555', fontWeight:400 }}>/mo</span></div>
                <div style={{ fontSize:12, color:'#555' }}>{count} active org{count!==1?'s':''}</div>
              </div>
            ))}
          </div>
          <div style={S.sectionTitle}>All Active Organizations</div>
          <div style={S.card}>
            {active.length === 0
              ? <div style={S.empty}>No active organizations</div>
              : <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Organization</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Cycle</th>
                    <th style={S.th}>Seats</th>
                    <th style={S.th}>Est. MRR</th>
                    <th style={S.th}>Since</th>
                  </tr></thead>
                  <tbody>
                    {active.map(o => {
                      const prices = TIER_PRICES[o.subscription_tier] || { monthly:0, annual:0 }
                      const base = o.custom_admin_price || ((o.subscription_tier === 'command_iii' ? 'annual' : 'monthly') === 'annual' ? prices.annual : prices.monthly)
                      const seats = Math.max(0, ((o.custom_seat_price ? 2 : 1)||1) - 1)
                      const est = base + seats * ((o.subscription_tier === 'command_iii' ? 'annual' : 'monthly') === 'annual' ? 26 : 29)
                      return (
                        <tr key={o.id}>
                          <td style={S.td}>{o.name}</td>
                          <td style={S.td}><span style={S.badge(TIER_COLOR[o.subscription_tier]||'#888')}>{TIER_LABEL[o.subscription_tier]||o.subscription_tier}</span></td>
                          <td style={S.td}>{(o.subscription_tier === 'command_iii' ? 'annual' : 'monthly') === 'annual' ? '📅 Annual' : '📆 Monthly'}</td>
                          <td style={S.td}>{(o.custom_seat_price ? 2 : 1)||1}</td>
                          <td style={{ ...S.td, color:'#4ec9b0', fontWeight:600 }}>{fmt$(est)}</td>
                          <td style={S.td}>{fmtDate(o.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
          </div>
        </div>
      )}
    </div>
  )
}
