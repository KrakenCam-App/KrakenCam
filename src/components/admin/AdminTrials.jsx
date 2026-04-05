/**
 * AdminTrials.jsx
 * Trial management: extend trials, convert to paid, see at-risk trials.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { adminRpc, adminUpdate } from '../../lib/adminFetch'

const S = {
  card: { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'20px 22px', marginBottom:16 },
  sectionTitle: { fontSize:14, fontWeight:600, color:'#ccc', marginBottom:12, letterSpacing:.3 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'9px 14px', background:'#111', color:'#8b9ab8', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:.6, borderBottom:'1px solid #222' },
  td: { padding:'10px 14px', borderBottom:'1px solid #1e1e1e', color:'#ccc', verticalAlign:'middle' },
  badge: (c) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${c}22`, color:c, border:`1px solid ${c}44` }),
  btn: { background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.3)', color:'#60a5fa', borderRadius:6, padding:'5px 11px', fontSize:11, cursor:'pointer', fontWeight:600 },
  greenBtn: { background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', color:'#4ade80', borderRadius:6, padding:'5px 11px', fontSize:11, cursor:'pointer', fontWeight:600 },
  input: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:6, color:'#e8e8e8', padding:'6px 10px', fontSize:12, outline:'none', width:60, textAlign:'center' },
  refreshBtn: { marginLeft:'auto', background:'transparent', border:'1px solid #333', borderRadius:7, color:'#888', padding:'6px 12px', fontSize:12, cursor:'pointer' },
  filterBar: { display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' },
  filterBtn: (active) => ({ padding:'6px 14px', borderRadius:16, fontSize:12, fontWeight: active ? 700 : 400, border:`1px solid ${active ? '#00d4ff' : '#6a7a8a'}`, background: active ? 'rgba(0,212,255,.08)' : 'transparent', color: active ? '#00d4ff' : '#888', cursor:'pointer' }),
  empty: { textAlign:'center', padding:'32px', color:'#7a8a9a', fontSize:13 },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px' },
  modalBox: { background:'#0f1521', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:'28px 24px', width:'100%', maxWidth:420 },
}

const TIER_COLOR = { capture_i:'#4ec9b0', intelligence_ii:'#00d4ff', command_iii:'#c792ea' }
const TIER_LABEL = { capture_i:'Capture I', intelligence_ii:'Intelligence II', command_iii:'Command III' }

function fmtDate(s) { if(!s) return '—'; return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }
function daysUntil(s) { if(!s) return null; return Math.ceil((new Date(s)-Date.now())/(1000*60*60*24)) }

export default function AdminTrials() {
  const [orgs,       setOrgs]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('all') // all | urgent | ending | expired
  const [extending,  setExtending]  = useState(null)  // org being extended
  const [extDays,    setExtDays]    = useState(7)
  const [extStatus,  setExtStatus]  = useState(null)
  const [converting, setConverting] = useState(null)  // org being converted
  const [convStatus, setConvStatus] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminRpc('admin_get_trialing_orgs')
    setOrgs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = orgs.filter(o => {
    const d = daysUntil(o.trial_ends_at)
    if (filter === 'urgent')  return d !== null && d <= 3
    if (filter === 'ending')  return d !== null && d <= 7 && d > 3
    if (filter === 'expired') return d !== null && d <= 0
    return true
  })

  const extendTrial = async () => {
    if (!extending) return
    setExtStatus('saving')
    try {
      const current = new Date(extending.trial_ends_at || Date.now())
      const newEnd = new Date(current.getTime() + extDays * 24 * 60 * 60 * 1000)
      await adminUpdate(
        'organizations',
        { trial_ends_at: newEnd.toISOString() },
        `id=eq.${extending.id}`
      )
      setExtStatus('ok')
      await load()
      setTimeout(() => { setExtending(null); setExtStatus(null) }, 1500)
    } catch (e) {
      console.error(e); setExtStatus('error')
    }
  }

  const convertToPaid = async (org) => {
    setConverting(org)
    setConvStatus(null)
  }

  const confirmConvert = async () => {
    if (!converting) return
    setConvStatus('saving')
    try {
      await adminUpdate(
        'organizations',
        { subscription_status: 'active', trial_ends_at: null },
        `id=eq.${converting.id}`
      )
      setConvStatus('ok')
      await load()
      setTimeout(() => { setConverting(null); setConvStatus(null) }, 1500)
    } catch (e) {
      console.error(e); setConvStatus('error')
    }
  }

  const urgent  = orgs.filter(o => { const d = daysUntil(o.trial_ends_at); return d !== null && d <= 3 })
  const ending  = orgs.filter(o => { const d = daysUntil(o.trial_ends_at); return d !== null && d <= 7 && d > 3 })
  const expired = orgs.filter(o => { const d = daysUntil(o.trial_ends_at); return d !== null && d <= 0 })

  if (loading) return <div style={{ color:'#8b9ab8', fontSize:13, padding:20 }}>Loading trials…</div>

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Total trialing', value:orgs.length,    color:'#00d4ff' },
          { label:'Ending ≤3 days', value:urgent.length,  color: urgent.length  ? '#f87171' : '#4ec9b0' },
          { label:'Ending this wk', value:ending.length,  color: ending.length  ? '#fbbf24' : '#4ec9b0' },
          { label:'Expired',        value:expired.length, color: expired.length ? '#f87171' : '#4ec9b0' },
        ].map(m => (
          <div key={m.label} style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontSize:11, color:'#8b9ab8', fontWeight:600, textTransform:'uppercase', letterSpacing:.7, marginBottom:6 }}>{m.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={S.filterBar}>
        {[
          { id:'all',     label:`All (${orgs.length})` },
          { id:'urgent',  label:`🔴 Urgent ≤3d (${urgent.length})` },
          { id:'ending',  label:`⚠️ This week (${ending.length})` },
          { id:'expired', label:`💀 Expired (${expired.length})` },
        ].map(f => (
          <button key={f.id} style={S.filterBtn(filter===f.id)} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
        <button style={S.refreshBtn} onClick={load}>↻ Refresh</button>
      </div>

      {/* Trials table */}
      <div style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, overflow:'hidden' }}>
        {filtered.length === 0
          ? <div style={S.empty}>No trials in this category</div>
          : <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Organization</th>
                <th style={S.th}>Tier</th>
                <th style={S.th}>Trial Ends</th>
                <th style={S.th}>Days Left</th>
                <th style={S.th}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(o => {
                  const d = daysUntil(o.trial_ends_at)
                  const dColor = d === null ? '#8b9ab8' : d <= 0 ? '#f87171' : d <= 3 ? '#f87171' : d <= 7 ? '#fbbf24' : '#4ec9b0'
                  return (
                    <tr key={o.id}>
                      <td style={S.td}>
                        <div style={{ fontWeight:600, color:'#e8e8e8' }}>{o.name}</div>
                        <div style={{ fontSize:11, color:'#8b9ab8' }}>/{o.slug}</div>
                      </td>
                      <td style={S.td}><span style={S.badge(TIER_COLOR[o.subscription_tier]||'#888')}>{TIER_LABEL[o.subscription_tier]||o.subscription_tier}</span></td>
                      <td style={S.td}>{fmtDate(o.trial_ends_at)}</td>
                      <td style={{ ...S.td, color:dColor, fontWeight:700, fontSize:15 }}>
                        {d === null ? '—' : d <= 0 ? 'Expired' : `${d}d`}
                      </td>
                      <td style={S.td}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <button style={S.btn} onClick={() => { setExtending(o); setExtDays(7); setExtStatus(null) }}>
                            ⏱ Extend
                          </button>
                          <button style={S.greenBtn} onClick={() => convertToPaid(o)}>
                            ✅ Convert to paid
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        }
      </div>

      {/* Extend modal */}
      {extending && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:6 }}>⏱ Extend Trial</div>
            <div style={{ fontSize:13, color:'#8b9ab8', marginBottom:20 }}>Extending trial for <strong style={{ color:'#fff' }}>{extending.name}</strong></div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <span style={{ fontSize:13, color:'#ccc' }}>Extend by</span>
              <input style={S.input} type="number" min={1} max={90} value={extDays} onChange={e => setExtDays(Number(e.target.value))} />
              <span style={{ fontSize:13, color:'#ccc' }}>days</span>
            </div>
            <div style={{ fontSize:12, color:'#8b9ab8', marginBottom:20 }}>
              New trial end: <strong style={{ color:'#fbbf24' }}>{fmtDate(new Date(new Date(extending.trial_ends_at||Date.now()).getTime() + extDays*24*60*60*1000).toISOString())}</strong>
            </div>
            {extStatus === 'ok'    && <div style={{ fontSize:13, color:'#4ade80', marginBottom:12 }}>✓ Trial extended successfully</div>}
            {extStatus === 'error' && <div style={{ fontSize:13, color:'#f87171', marginBottom:12 }}>✗ Failed to extend trial</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button style={{ ...S.btn, flex:1, justifyContent:'center', background:'transparent', color:'#888', border:'1px solid #333' }} onClick={() => setExtending(null)}>Cancel</button>
              <button style={{ ...S.btn, flex:2, justifyContent:'center' }} disabled={extStatus==='saving'} onClick={extendTrial}>
                {extStatus === 'saving' ? '⏳ Saving…' : `Extend ${extDays} days`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert modal */}
      {converting && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:6 }}>✅ Convert to Paid</div>
            <div style={{ fontSize:13, color:'#8b9ab8', marginBottom:20, lineHeight:1.6 }}>
              This will set <strong style={{ color:'#fff' }}>{converting.name}</strong> to <strong style={{ color:'#4ade80' }}>active</strong> status immediately, removing the trial end date.<br/><br/>
              <strong style={{ color:'#fbbf24' }}>Important:</strong> Make sure you have collected payment in Stripe before confirming — this does not charge the customer automatically.
            </div>
            {convStatus === 'ok'    && <div style={{ fontSize:13, color:'#4ade80', marginBottom:12 }}>✓ Converted to paid successfully</div>}
            {convStatus === 'error' && <div style={{ fontSize:13, color:'#f87171', marginBottom:12 }}>✗ Failed to convert</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button style={{ ...S.btn, flex:1, background:'transparent', color:'#888', border:'1px solid #333' }} onClick={() => setConverting(null)}>Cancel</button>
              <button style={{ ...S.greenBtn, flex:2 }} disabled={convStatus==='saving'} onClick={confirmConvert}>
                {convStatus === 'saving' ? '⏳ Saving…' : '✅ Confirm — Set as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
