/**
 * AdminReferrals.jsx
 * Combined Referral + Affiliate management system.
 * Tabs: Referrals (user-to-user) | Affiliates | Settings
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { adminFrom, adminInsert, adminUpdate } from '../../lib/adminFetch'

/* ─── Styles ────────────────────────────────────────────────────────────────── */
const S = {
  card:    { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'20px 22px', marginBottom:14 },
  title:   { fontSize:14, fontWeight:600, color:'#ccc', marginBottom:12, letterSpacing:.3 },
  table:   { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:      { textAlign:'left', padding:'9px 14px', background:'#111', color:'#8b9ab8', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:.6, borderBottom:'1px solid #222' },
  td:      { padding:'10px 14px', borderBottom:'1px solid #1e1e1e', color:'#ccc', verticalAlign:'middle' },
  badge:   (c) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${c}22`, color:c, border:`1px solid ${c}44` }),
  btn:     { background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.3)', color:'#60a5fa', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 },
  greenBtn:{ background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', color:'#4ade80', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 },
  redBtn:  { background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', color:'#f87171', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 },
  input:   { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'8px 11px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  select:  { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'8px 11px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  label:   { fontSize:12, color:'#888', marginBottom:5, display:'block' },
  empty:   { textAlign:'center', padding:'32px', color:'#7a8a9a', fontSize:13 },
  section: { fontSize:11, fontWeight:700, color:'#8b9ab8', textTransform:'uppercase', letterSpacing:.8, marginBottom:10, marginTop:20, paddingBottom:6, borderBottom:'1px solid #222' },
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function fmt$(n) { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) }
function fmtDate(s) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }
function genCode() { return Math.random().toString(36).substring(2, 10).toUpperCase() }

const REF_STATUS_COLOR   = { pending:'#fbbf24', qualified:'#60a5fa', reward_pending:'#a78bfa', paid:'#4ade80', rejected:'#f87171' }
const AFF_STATUS_COLOR   = { active:'#4ade80', inactive:'#8b9ab8', suspended:'#f87171' }
const CONV_STATUS_COLOR  = { pending:'#fbbf24', approved:'#60a5fa', paid:'#4ade80', rejected:'#f87171' }

/* ─── Toast ─────────────────────────────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null
  const colors = { success:'#4ade80', error:'#f87171', info:'#60a5fa' }
  const c = colors[toast.type] || colors.info
  return (
    <div style={{ position:'fixed', bottom:28, right:28, zIndex:10000, background:'#111', border:`1px solid ${c}44`, borderLeft:`3px solid ${c}`, borderRadius:8, padding:'12px 18px', fontSize:13, color:'#e8e8e8', boxShadow:'0 4px 20px rgba(0,0,0,.6)', maxWidth:340 }}>
      {toast.msg}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const show = useCallback((msg, type = 'success') => {
    clearTimeout(timerRef.current)
    setToast({ msg, type })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])
  return { toast, show }
}

/* ─── Referral status label helper ──────────────────────────────────────────── */
function refLabel(status) {
  return { pending:'Pending', qualified:'Qualified', reward_pending:'Reward Pending', paid:'Paid', rejected:'Rejected' }[status] || status
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export default function AdminReferrals() {
  const [tab,         setTab]         = useState('referrals')
  const [loading,     setLoading]     = useState(true)

  // Data
  const [referrals,   setReferrals]   = useState([])
  const [affiliates,  setAffiliates]  = useState([])
  const [conversions, setConversions] = useState([])
  const [refSettings, setRefSettings] = useState(null)
  const [affSettings, setAffSettings] = useState(null)

  // Affiliate side panel
  const [showAffForm, setShowAffForm] = useState(false)
  const [editAff,     setEditAff]     = useState(null)
  const [saving,      setSaving]      = useState(false)

  // Settings save
  const [savingRef,   setSavingRef]   = useState(false)
  const [savingAff,   setSavingAff]   = useState(false)

  // Note editing inline (referrals)
  const [editNote,    setEditNote]    = useState(null)  // { id, text }

  const { toast, show: showToast } = useToast()

  const blankAff = {
    name:'', email:'', code:'', contact_name:'', affiliate_type:'content_creator',
    website_url:'', custom_landing_url:'', payout_type:'percent', payout_value:'20',
    qualification_type:'first_payment', qualification_threshold:'1',
    status:'active', notes:'',
  }
  const [affForm, setAffForm] = useState(blankAff)

  const blankRefSettings = {
    enabled: true, reward_type:'credit', reward_amount:'25',
    qualification_type:'first_payment', qualification_threshold:'1',
    max_referrals_per_user:'', program_description:'',
  }
  const blankAffSettings = {
    enabled: true, default_payout_type:'percent', default_payout_value:'20',
    default_qualification_type:'first_payment', default_qualification_threshold:'1',
    cookie_duration_days:'30',
  }
  const [refForm, setRefForm] = useState(blankRefSettings)
  const [affSettingsForm, setAffSettingsForm] = useState(blankAffSettings)

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [refs, affs, convs, rs, as] = await Promise.all([
        adminFrom('user_referrals',             'select=*,referrer:profiles!referrer_user_id(full_name,email),referred:profiles!referred_user_id(full_name,email),organizations(name)&order=created_at.desc&limit=200'),
        adminFrom('affiliates',                  'select=*&order=created_at.desc'),
        adminFrom('affiliate_conversions',       'select=*,affiliates(name,code),organizations(name)&order=created_at.desc&limit=200'),
        adminFrom('referral_program_settings',   'select=*&limit=1'),
        adminFrom('affiliate_program_settings',  'select=*&limit=1'),
      ])
      setReferrals(Array.isArray(refs) ? refs : [])
      setAffiliates(Array.isArray(affs) ? affs : [])
      setConversions(Array.isArray(convs) ? convs : [])

      const rs0 = Array.isArray(rs) && rs[0] ? rs[0] : null
      const as0 = Array.isArray(as) && as[0] ? as[0] : null
      setRefSettings(rs0)
      setAffSettings(as0)
      if (rs0) setRefForm({
        enabled:                rs0.enabled ?? true,
        reward_type:            rs0.reward_type || 'credit',
        reward_amount:          String(rs0.reward_amount ?? 25),
        qualification_type:     rs0.qualification_type || 'first_payment',
        qualification_threshold:String(rs0.qualification_threshold ?? 1),
        max_referrals_per_user: rs0.max_referrals_per_user ? String(rs0.max_referrals_per_user) : '',
        program_description:    rs0.program_description || '',
      })
      if (as0) setAffSettingsForm({
        enabled:                        as0.enabled ?? true,
        default_payout_type:            as0.default_payout_type || 'percent',
        default_payout_value:           String(as0.default_payout_value ?? 20),
        default_qualification_type:     as0.default_qualification_type || 'first_payment',
        default_qualification_threshold:String(as0.default_qualification_threshold ?? 1),
        cookie_duration_days:           String(as0.cookie_duration_days ?? 30),
      })
    } catch (e) {
      console.warn('AdminReferrals load error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ── KPI ── */
  const activeAff         = affiliates.filter(a => a.status === 'active' || a.active).length
  const totalConversions  = affiliates.reduce((s, a) => s + (a.total_conversions || 0), 0)
  const commOwed          = affiliates.reduce((s, a) => s + Math.max(0, (a.total_commission_owed || 0) - (a.total_commission_paid || 0)), 0)
  const commPaid          = affiliates.reduce((s, a) => s + (a.total_commission_paid || 0), 0)
  const pendingRefRewards = referrals.filter(r => r.status === 'reward_pending').reduce((s, r) => s + (r.reward_amount || 0), 0)
  const paidRefRewards    = referrals.filter(r => r.status === 'paid').reduce((s, r) => s + (r.reward_amount || 0), 0)

  /* ── Referral actions ── */
  const refAction = async (r, newStatus) => {
    const payload = { status: newStatus }
    if (newStatus === 'qualified')       payload.qualified_at = new Date().toISOString()
    if (newStatus === 'reward_pending')  payload.qualified_at = payload.qualified_at || r.qualified_at || new Date().toISOString()
    if (newStatus === 'paid')            payload.paid_at = new Date().toISOString()
    try {
      await adminUpdate('user_referrals', payload, `id=eq.${r.id}`)
      showToast(`Referral marked ${newStatus.replace('_', ' ')}`)
      load()
    } catch (e) {
      showToast('Error updating referral', 'error')
    }
  }

  const saveNote = async () => {
    if (!editNote) return
    try {
      await adminUpdate('user_referrals', { notes: editNote.text }, `id=eq.${editNote.id}`)
      showToast('Note saved')
      setEditNote(null)
      load()
    } catch (e) {
      showToast('Error saving note', 'error')
    }
  }

  /* ── Conversion actions ── */
  const convAction = async (c, newStatus) => {
    const payload = { status: newStatus }
    if (newStatus === 'paid') {
      payload.paid_at = new Date().toISOString()
      // Update affiliate totals
      const aff = affiliates.find(a => a.id === c.affiliate_id)
      if (aff && c.commission_amount) {
        await adminUpdate('affiliates', {
          total_commission_paid: (aff.total_commission_paid || 0) + (c.commission_amount || 0),
        }, `id=eq.${aff.id}`)
      }
    }
    try {
      await adminUpdate('affiliate_conversions', payload, `id=eq.${c.id}`)
      showToast(`Conversion marked ${newStatus}`)
      load()
    } catch (e) {
      showToast('Error updating conversion', 'error')
    }
  }

  /* ── Affiliate form ── */
  const openNewAff = () => { setAffForm({ ...blankAff, code: genCode() }); setEditAff(null); setShowAffForm(true) }
  const openEditAff = (a) => {
    setAffForm({
      name:                    a.name || '',
      email:                   a.email || '',
      code:                    a.code || '',
      contact_name:            a.contact_name || '',
      affiliate_type:          a.affiliate_type || 'content_creator',
      website_url:             a.website_url || '',
      custom_landing_url:      a.custom_landing_url || '',
      payout_type:             a.payout_type || 'percent',
      payout_value:            String(a.payout_value ?? a.commission_pct ?? 20),
      qualification_type:      a.qualification_type || 'first_payment',
      qualification_threshold: String(a.qualification_threshold ?? 1),
      status:                  a.status || (a.active ? 'active' : 'inactive'),
      notes:                   a.notes || '',
    })
    setEditAff(a)
    setShowAffForm(true)
  }

  const saveAff = async () => {
    if (!affForm.name.trim() || !affForm.code.trim()) { showToast('Name and code are required', 'error'); return }
    setSaving(true)
    const payload = {
      name:                    affForm.name.trim(),
      email:                   affForm.email.trim(),
      code:                    affForm.code.trim().toUpperCase(),
      contact_name:            affForm.contact_name.trim() || null,
      affiliate_type:          affForm.affiliate_type,
      website_url:             affForm.website_url.trim() || null,
      custom_landing_url:      affForm.custom_landing_url.trim() || null,
      payout_type:             affForm.payout_type,
      payout_value:            parseFloat(affForm.payout_value) || 20,
      // keep legacy columns in sync
      commission_pct:          affForm.payout_type === 'percent' ? parseFloat(affForm.payout_value) || 20 : null,
      commission_flat:         affForm.payout_type === 'flat' ? parseFloat(affForm.payout_value) || null : null,
      qualification_type:      affForm.qualification_type,
      qualification_threshold: parseInt(affForm.qualification_threshold) || 1,
      status:                  affForm.status,
      active:                  affForm.status === 'active',
      notes:                   affForm.notes,
    }
    try {
      if (editAff) {
        await adminUpdate('affiliates', payload, `id=eq.${editAff.id}`)
        showToast('Affiliate updated')
      } else {
        await adminInsert('affiliates', payload)
        showToast('Affiliate created')
      }
      setShowAffForm(false)
      load()
    } catch (e) {
      showToast('Error saving affiliate', 'error')
    }
    setSaving(false)
  }

  /* ── Settings save ── */
  const saveRefSettings = async () => {
    setSavingRef(true)
    const payload = {
      enabled:                 refForm.enabled,
      reward_type:             refForm.reward_type,
      reward_amount:           parseFloat(refForm.reward_amount) || 25,
      qualification_type:      refForm.qualification_type,
      qualification_threshold: parseInt(refForm.qualification_threshold) || 1,
      max_referrals_per_user:  refForm.max_referrals_per_user ? parseInt(refForm.max_referrals_per_user) : null,
      program_description:     refForm.program_description,
    }
    try {
      if (refSettings?.id) {
        await adminUpdate('referral_program_settings', payload, `id=eq.${refSettings.id}`)
      } else {
        await adminInsert('referral_program_settings', payload)
      }
      showToast('Referral settings saved')
      load()
    } catch (e) {
      showToast('Error saving referral settings', 'error')
    }
    setSavingRef(false)
  }

  const saveAffSettings = async () => {
    setSavingAff(true)
    const payload = {
      enabled:                         affSettingsForm.enabled,
      default_payout_type:             affSettingsForm.default_payout_type,
      default_payout_value:            parseFloat(affSettingsForm.default_payout_value) || 20,
      default_qualification_type:      affSettingsForm.default_qualification_type,
      default_qualification_threshold: parseInt(affSettingsForm.default_qualification_threshold) || 1,
      cookie_duration_days:            parseInt(affSettingsForm.cookie_duration_days) || 30,
    }
    try {
      if (affSettings?.id) {
        await adminUpdate('affiliate_program_settings', payload, `id=eq.${affSettings.id}`)
      } else {
        await adminInsert('affiliate_program_settings', payload)
      }
      showToast('Affiliate settings saved')
      load()
    } catch (e) {
      showToast('Error saving affiliate settings', 'error')
    }
    setSavingAff(false)
  }

  /* ── Referral link helper ── */
  const copyLink = (code) => {
    const url = `https://app.krakencam.com/signup?ref=${code}`
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!'))
  }

  /* ── Format payout ── */
  const fmtPayout = (a) => {
    if (a.payout_type === 'flat' && a.payout_value) return fmt$(a.payout_value) + ' flat'
    if (a.payout_type === 'percent' && a.payout_value) return `${a.payout_value}%`
    if (a.commission_flat) return fmt$(a.commission_flat) + ' flat'
    if (a.commission_pct) return `${a.commission_pct}%`
    return '—'
  }

  /* ─────────────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display:'flex', gap:20 }}>
      {/* Main column */}
      <div style={{ flex:1, minWidth:0 }}>

        {/* KPI Row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Active Affiliates',    value:activeAff,            color:'#00d4ff' },
            { label:'Total Conversions',    value:totalConversions,     color:'#4ade80' },
            { label:'Commission Owed',      value:fmt$(commOwed),       color:'#fbbf24' },
            { label:'Commission Paid',      value:fmt$(commPaid),       color:'#4ec9b0' },
            { label:'Pending Ref. Rewards', value:fmt$(pendingRefRewards), color:'#a78bfa' },
            { label:'Paid Ref. Rewards',    value:fmt$(paidRefRewards), color:'#34d399' },
          ].map(m => (
            <div key={m.label} style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'15px 17px' }}>
              <div style={{ fontSize:10, color:'#8b9ab8', fontWeight:600, textTransform:'uppercase', letterSpacing:.7, marginBottom:5 }}>{m.label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid #222', alignItems:'center' }}>
          {[['referrals','👥 Referrals'],['affiliates','🤝 Affiliates'],['settings','⚙️ Settings']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding:'8px 18px', background:'transparent', border:'none', borderBottom:tab===id?'2px solid #00d4ff':'2px solid transparent', color:tab===id?'#00d4ff':'#9aaabb', fontSize:13, fontWeight:tab===id?600:400, cursor:'pointer', marginBottom:-1 }}>
              {label}
            </button>
          ))}
          <button style={{ ...S.btn, marginLeft:'auto', fontSize:11, padding:'5px 12px' }} onClick={load}>↻</button>
          {tab === 'affiliates' && (
            <button style={{ ...S.greenBtn, fontSize:11, padding:'5px 12px' }} onClick={openNewAff}>+ New Affiliate</button>
          )}
        </div>

        {loading && <div style={{ color:'#8b9ab8', fontSize:13 }}>Loading…</div>}

        {/* ── REFERRALS TAB ── */}
        {!loading && tab === 'referrals' && (
          <div>
            <div style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, overflow:'hidden' }}>
              {referrals.length === 0
                ? <div style={S.empty}>No user referrals yet. Referrals are recorded when users sign up via a referral link.</div>
                : <div style={{ overflowX:'auto' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Referrer</th>
                          <th style={S.th}>Referred</th>
                          <th style={S.th}>Code</th>
                          <th style={S.th}>Signed Up</th>
                          <th style={S.th}>Reward</th>
                          <th style={S.th}>Status</th>
                          <th style={S.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map(r => (
                          <tr key={r.id}>
                            <td style={S.td}>
                              <div style={{ fontWeight:600, color:'#e8e8e8', fontSize:13 }}>{r.referrer?.full_name || r.referrer_user_id?.slice(0,8) || '—'}</div>
                              <div style={{ fontSize:11, color:'#8b9ab8' }}>{r.referrer?.email || ''}</div>
                            </td>
                            <td style={S.td}>
                              <div style={{ fontSize:13, color:'#ccc' }}>{r.referred?.full_name || r.referred_email || '—'}</div>
                              <div style={{ fontSize:11, color:'#8b9ab8' }}>{r.organizations?.name || ''}</div>
                            </td>
                            <td style={S.td}>
                              <code style={{ background:'#111', padding:'2px 8px', borderRadius:4, fontSize:11, color:'#00d4ff' }}>{r.referral_code || '—'}</code>
                            </td>
                            <td style={{ ...S.td, fontSize:12, color:'#8b9ab8' }}>{fmtDate(r.created_at)}</td>
                            <td style={{ ...S.td, color:'#a78bfa', fontWeight:600 }}>{r.reward_amount ? fmt$(r.reward_amount) : '—'}</td>
                            <td style={S.td}>
                              <span style={S.badge(REF_STATUS_COLOR[r.status] || '#8b9ab8')}>{refLabel(r.status)}</span>
                            </td>
                            <td style={S.td}>
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                                {r.status === 'pending' && (
                                  <button style={{ ...S.greenBtn, fontSize:10, padding:'3px 8px' }} onClick={() => refAction(r, 'qualified')}>Qualify</button>
                                )}
                                {r.status === 'qualified' && (
                                  <button style={{ ...S.btn, fontSize:10, padding:'3px 8px', color:'#a78bfa', borderColor:'rgba(167,139,250,.3)' }} onClick={() => refAction(r, 'reward_pending')}>Issue Reward</button>
                                )}
                                {r.status === 'reward_pending' && (
                                  <button style={{ ...S.greenBtn, fontSize:10, padding:'3px 8px' }} onClick={() => refAction(r, 'paid')}>Mark Paid</button>
                                )}
                                {(r.status === 'pending' || r.status === 'qualified') && (
                                  <button style={{ ...S.redBtn, fontSize:10, padding:'3px 8px' }} onClick={() => refAction(r, 'rejected')}>Reject</button>
                                )}
                                <button
                                  style={{ background:'transparent', border:'1px solid #2a2a2a', color:'#8b9ab8', borderRadius:5, fontSize:10, padding:'3px 8px', cursor:'pointer' }}
                                  onClick={() => setEditNote({ id:r.id, text:r.notes || '' })}
                                  title="Add note"
                                >📝</button>
                              </div>
                              {editNote?.id === r.id && (
                                <div style={{ marginTop:6, display:'flex', gap:5 }}>
                                  <input style={{ ...S.input, fontSize:11, padding:'4px 8px' }} value={editNote.text} onChange={e => setEditNote(n => ({ ...n, text:e.target.value }))} placeholder="Note…" />
                                  <button style={{ ...S.btn, fontSize:10, padding:'3px 8px', whiteSpace:'nowrap' }} onClick={saveNote}>Save</button>
                                  <button style={{ background:'transparent', border:'1px solid #333', color:'#888', borderRadius:5, fontSize:10, padding:'3px 8px', cursor:'pointer' }} onClick={() => setEditNote(null)}>✕</button>
                                </div>
                              )}
                              {r.notes && editNote?.id !== r.id && (
                                <div style={{ fontSize:10, color:'#8b9ab8', marginTop:4, fontStyle:'italic' }}>{r.notes}</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>

            {/* Referral link format hint */}
            <div style={{ ...S.card, marginTop:14, fontSize:12, color:'#8b9ab8', lineHeight:1.9 }}>
              💡 <strong style={{ color:'#888' }}>User referral link format:</strong>{' '}
              <code style={{ color:'#60a5fa' }}>https://app.krakencam.com/signup?ref=CODE</code>
              <br/>Users share their personal referral code. When someone signs up via that link, a <code style={{ color:'#60a5fa' }}>user_referrals</code> record is created automatically.
            </div>
          </div>
        )}

        {/* ── AFFILIATES TAB ── */}
        {!loading && tab === 'affiliates' && (
          <div>
            {/* Affiliates table */}
            <div style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid #222', fontSize:13, fontWeight:600, color:'#ccc' }}>Affiliates</div>
              {affiliates.length === 0
                ? <div style={S.empty}>No affiliates yet. Add one to start tracking.</div>
                : <div style={{ overflowX:'auto' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Affiliate</th>
                          <th style={S.th}>Code</th>
                          <th style={S.th}>Type</th>
                          <th style={S.th}>Payout</th>
                          <th style={S.th}>Conversions</th>
                          <th style={S.th}>Owed</th>
                          <th style={S.th}>Paid</th>
                          <th style={S.th}>Status</th>
                          <th style={S.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {affiliates.map(a => {
                          const owed = Math.max(0, (a.total_commission_owed || 0) - (a.total_commission_paid || 0))
                          const affStatus = a.status || (a.active ? 'active' : 'inactive')
                          return (
                            <tr key={a.id}>
                              <td style={S.td}>
                                <div style={{ fontWeight:600, color:'#e8e8e8' }}>{a.name}</div>
                                <div style={{ fontSize:11, color:'#8b9ab8' }}>{a.contact_name || a.email}</div>
                              </td>
                              <td style={S.td}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <code style={{ background:'#111', padding:'2px 8px', borderRadius:4, fontSize:11, color:'#00d4ff' }}>{a.code}</code>
                                  <button style={{ background:'transparent', border:'none', color:'#8b9ab8', cursor:'pointer', fontSize:12, padding:0 }} onClick={() => copyLink(a.code)} title="Copy referral link">⧉</button>
                                </div>
                              </td>
                              <td style={{ ...S.td, fontSize:12, color:'#8b9ab8' }}>
                                {(a.affiliate_type || 'N/A').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </td>
                              <td style={{ ...S.td, fontSize:12 }}>{fmtPayout(a)}</td>
                              <td style={{ ...S.td, textAlign:'center' }}>{a.total_conversions || 0}</td>
                              <td style={{ ...S.td, color:'#fbbf24', fontWeight:600 }}>{fmt$(owed)}</td>
                              <td style={{ ...S.td, color:'#4ec9b0' }}>{fmt$(a.total_commission_paid)}</td>
                              <td style={S.td}><span style={S.badge(AFF_STATUS_COLOR[affStatus] || '#8b9ab8')}>{affStatus}</span></td>
                              <td style={S.td}>
                                <button style={{ ...S.btn, fontSize:11, padding:'4px 10px' }} onClick={() => openEditAff(a)}>Edit</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </div>

            {/* Conversions table */}
            <div style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, overflow:'hidden' }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid #222', fontSize:13, fontWeight:600, color:'#ccc' }}>Affiliate Conversions</div>
              {conversions.length === 0
                ? <div style={S.empty}>No conversions recorded yet.</div>
                : <div style={{ overflowX:'auto' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Affiliate</th>
                          <th style={S.th}>Org / Customer</th>
                          <th style={S.th}>Event</th>
                          <th style={S.th}>Sub. Amount</th>
                          <th style={S.th}>Commission</th>
                          <th style={S.th}>Date</th>
                          <th style={S.th}>Status</th>
                          <th style={S.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversions.map(c => (
                          <tr key={c.id}>
                            <td style={S.td}>{c.affiliates?.name || '—'}</td>
                            <td style={S.td}>
                              <div>{c.organizations?.name || '—'}</div>
                              {c.affiliates?.code && <code style={{ fontSize:10, color:'#8b9ab8' }}>{c.affiliates.code}</code>}
                            </td>
                            <td style={{ ...S.td, fontSize:12, color:'#8b9ab8', textTransform:'capitalize' }}>{c.event_type || '—'}</td>
                            <td style={{ ...S.td, color:'#ccc' }}>{c.subscription_amount ? fmt$(c.subscription_amount) : '—'}</td>
                            <td style={{ ...S.td, color:'#fbbf24', fontWeight:600 }}>{c.commission_amount ? fmt$(c.commission_amount) : '—'}</td>
                            <td style={{ ...S.td, fontSize:12, color:'#8b9ab8' }}>{fmtDate(c.converted_at || c.created_at)}</td>
                            <td style={S.td}><span style={S.badge(CONV_STATUS_COLOR[c.status] || '#8b9ab8')}>{c.status || 'pending'}</span></td>
                            <td style={S.td}>
                              <div style={{ display:'flex', gap:5 }}>
                                {c.status === 'pending' && (
                                  <button style={{ ...S.btn, fontSize:10, padding:'3px 8px' }} onClick={() => convAction(c, 'approved')}>Approve</button>
                                )}
                                {c.status === 'approved' && (
                                  <button style={{ ...S.greenBtn, fontSize:10, padding:'3px 8px' }} onClick={() => convAction(c, 'paid')}>Mark Paid</button>
                                )}
                                {(c.status === 'pending' || c.status === 'approved') && (
                                  <button style={{ ...S.redBtn, fontSize:10, padding:'3px 8px' }} onClick={() => convAction(c, 'rejected')}>Reject</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {!loading && tab === 'settings' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* Referral Program Settings */}
            <div style={S.card}>
              <div style={S.title}>👥 Referral Program</div>

              <label style={S.label}>Program enabled</label>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#ccc', cursor:'pointer', marginBottom:12 }}>
                <input type="checkbox" checked={!!refForm.enabled} onChange={e => setRefForm(f => ({ ...f, enabled:e.target.checked }))} />
                Users can refer others and earn rewards
              </label>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={S.label}>Reward type</label>
                  <select style={S.select} value={refForm.reward_type} onChange={e => setRefForm(f => ({ ...f, reward_type:e.target.value }))}>
                    <option value="credit">Account Credit</option>
                    <option value="cash">Cash Payout</option>
                    <option value="discount">Discount Code</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Reward amount ($)</label>
                  <input style={S.input} type="number" min="0" value={refForm.reward_amount} onChange={e => setRefForm(f => ({ ...f, reward_amount:e.target.value }))} placeholder="25" />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={S.label}>Qualify on</label>
                  <select style={S.select} value={refForm.qualification_type} onChange={e => setRefForm(f => ({ ...f, qualification_type:e.target.value }))}>
                    <option value="signup">Signup</option>
                    <option value="first_payment">First payment</option>
                    <option value="subscription_months">Subscription months</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Threshold</label>
                  <input style={S.input} type="number" min="1" value={refForm.qualification_threshold} onChange={e => setRefForm(f => ({ ...f, qualification_threshold:e.target.value }))} placeholder="1" />
                </div>
              </div>

              <div style={{ marginBottom:10 }}>
                <label style={S.label}>Max referrals per user (blank = unlimited)</label>
                <input style={S.input} type="number" min="1" value={refForm.max_referrals_per_user} onChange={e => setRefForm(f => ({ ...f, max_referrals_per_user:e.target.value }))} placeholder="Unlimited" />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={S.label}>Program description (shown to users)</label>
                <textarea style={{ ...S.input, minHeight:60, resize:'vertical' }} value={refForm.program_description} onChange={e => setRefForm(f => ({ ...f, program_description:e.target.value }))} placeholder="Refer a friend and earn $25 when they subscribe…" />
              </div>

              <button style={{ ...S.greenBtn, width:'100%' }} disabled={savingRef} onClick={saveRefSettings}>
                {savingRef ? '⏳ Saving…' : '✓ Save Referral Settings'}
              </button>
            </div>

            {/* Affiliate Program Settings */}
            <div style={S.card}>
              <div style={S.title}>🤝 Affiliate Program</div>

              <label style={S.label}>Program enabled</label>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#ccc', cursor:'pointer', marginBottom:12 }}>
                <input type="checkbox" checked={!!affSettingsForm.enabled} onChange={e => setAffSettingsForm(f => ({ ...f, enabled:e.target.checked }))} />
                Affiliates can earn commissions on referrals
              </label>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={S.label}>Default payout type</label>
                  <select style={S.select} value={affSettingsForm.default_payout_type} onChange={e => setAffSettingsForm(f => ({ ...f, default_payout_type:e.target.value }))}>
                    <option value="percent">Percent of sale</option>
                    <option value="flat">Flat amount</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Default payout value</label>
                  <input style={S.input} type="number" min="0" value={affSettingsForm.default_payout_value} onChange={e => setAffSettingsForm(f => ({ ...f, default_payout_value:e.target.value }))} placeholder="20" />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={S.label}>Qualify on</label>
                  <select style={S.select} value={affSettingsForm.default_qualification_type} onChange={e => setAffSettingsForm(f => ({ ...f, default_qualification_type:e.target.value }))}>
                    <option value="signup">Signup</option>
                    <option value="first_payment">First payment</option>
                    <option value="subscription_months">Subscription months</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Threshold</label>
                  <input style={S.input} type="number" min="1" value={affSettingsForm.default_qualification_threshold} onChange={e => setAffSettingsForm(f => ({ ...f, default_qualification_threshold:e.target.value }))} placeholder="1" />
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={S.label}>Cookie duration (days)</label>
                <input style={S.input} type="number" min="1" value={affSettingsForm.cookie_duration_days} onChange={e => setAffSettingsForm(f => ({ ...f, cookie_duration_days:e.target.value }))} placeholder="30" />
              </div>

              <div style={{ marginBottom:14, padding:'10px 12px', background:'#111', borderRadius:7, fontSize:12, color:'#8b9ab8', lineHeight:1.8 }}>
                💡 <strong style={{ color:'#888' }}>Affiliate link format:</strong><br/>
                <code style={{ color:'#60a5fa' }}>https://app.krakencam.com/signup?ref=CODE</code>
              </div>

              <button style={{ ...S.greenBtn, width:'100%' }} disabled={savingAff} onClick={saveAffSettings}>
                {savingAff ? '⏳ Saving…' : '✓ Save Affiliate Settings'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── AFFILIATE SIDE PANEL ── */}
      {showAffForm && (
        <div style={{ width:340, flexShrink:0 }}>
          <div style={{ position:'sticky', top:0, background:'#111', border:'1px solid #252525', borderRadius:12, padding:'20px 18px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#e8e8e8' }}>{editAff ? '✏️ Edit Affiliate' : '🤝 New Affiliate'}</div>
              <button style={{ background:'transparent', border:'none', color:'#8b9ab8', cursor:'pointer', fontSize:16 }} onClick={() => setShowAffForm(false)}>✕</button>
            </div>

            <div style={S.section}>Identity</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <label style={S.label}>Display Name *</label>
                <input style={S.input} value={affForm.name} onChange={e => setAffForm(f => ({ ...f, name:e.target.value }))} placeholder="Company or creator name" />
              </div>
              <div>
                <label style={S.label}>Contact Name</label>
                <input style={S.input} value={affForm.contact_name} onChange={e => setAffForm(f => ({ ...f, contact_name:e.target.value }))} placeholder="Primary contact" />
              </div>
              <div>
                <label style={S.label}>Email</label>
                <input style={S.input} type="email" value={affForm.email} onChange={e => setAffForm(f => ({ ...f, email:e.target.value }))} placeholder="contact@example.com" />
              </div>
              <div>
                <label style={S.label}>Affiliate Type</label>
                <select style={S.select} value={affForm.affiliate_type} onChange={e => setAffForm(f => ({ ...f, affiliate_type:e.target.value }))}>
                  <option value="content_creator">Content Creator</option>
                  <option value="agency">Agency</option>
                  <option value="reseller">Reseller</option>
                  <option value="influencer">Influencer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div style={S.section}>Referral Code & Links</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <label style={S.label}>Referral Code *</label>
                <div style={{ display:'flex', gap:6 }}>
                  <input style={S.input} value={affForm.code} onChange={e => setAffForm(f => ({ ...f, code:e.target.value.toUpperCase() }))} placeholder="e.g. JOHN20" />
                  <button style={{ ...S.btn, whiteSpace:'nowrap', fontSize:11 }} onClick={() => setAffForm(f => ({ ...f, code:genCode() }))}>Gen</button>
                </div>
              </div>
              <div>
                <label style={S.label}>Website URL</label>
                <input style={S.input} value={affForm.website_url} onChange={e => setAffForm(f => ({ ...f, website_url:e.target.value }))} placeholder="https://example.com" />
              </div>
              <div>
                <label style={S.label}>Custom Landing URL (optional override)</label>
                <input style={S.input} value={affForm.custom_landing_url} onChange={e => setAffForm(f => ({ ...f, custom_landing_url:e.target.value }))} placeholder="https://krakencam.com/lp/partner" />
              </div>
              {affForm.code && (
                <div style={{ background:'#0f0f0f', border:'1px solid #222', borderRadius:7, padding:'8px 10px', fontSize:11, color:'#8b9ab8' }}>
                  Link: <code style={{ color:'#60a5fa' }}>https://app.krakencam.com/signup?ref={affForm.code}</code>
                </div>
              )}
            </div>

            <div style={S.section}>Payout</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <label style={S.label}>Payout type</label>
                  <select style={S.select} value={affForm.payout_type} onChange={e => setAffForm(f => ({ ...f, payout_type:e.target.value }))}>
                    <option value="percent">Percent</option>
                    <option value="flat">Flat $</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>{affForm.payout_type === 'percent' ? 'Rate (%)' : 'Amount ($)'}</label>
                  <input style={S.input} type="number" min="0" value={affForm.payout_value} onChange={e => setAffForm(f => ({ ...f, payout_value:e.target.value }))} placeholder={affForm.payout_type === 'percent' ? '20' : '50'} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <label style={S.label}>Qualify on</label>
                  <select style={S.select} value={affForm.qualification_type} onChange={e => setAffForm(f => ({ ...f, qualification_type:e.target.value }))}>
                    <option value="signup">Signup</option>
                    <option value="first_payment">First payment</option>
                    <option value="subscription_months">Sub. months</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Threshold</label>
                  <input style={S.input} type="number" min="1" value={affForm.qualification_threshold} onChange={e => setAffForm(f => ({ ...f, qualification_threshold:e.target.value }))} placeholder="1" />
                </div>
              </div>
            </div>

            <div style={S.section}>Status &amp; Notes</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <label style={S.label}>Status</label>
                <select style={S.select} value={affForm.status} onChange={e => setAffForm(f => ({ ...f, status:e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Internal notes</label>
                <textarea style={{ ...S.input, minHeight:60, resize:'vertical' }} value={affForm.notes} onChange={e => setAffForm(f => ({ ...f, notes:e.target.value }))} placeholder="Optional notes…" />
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:18 }}>
              <button style={{ ...S.btn, flex:1, background:'transparent', color:'#888', border:'1px solid #333' }} onClick={() => setShowAffForm(false)}>Cancel</button>
              <button style={{ ...S.greenBtn, flex:2 }} disabled={saving || !affForm.name || !affForm.code} onClick={saveAff}>
                {saving ? '⏳ Saving…' : editAff ? '✓ Save Changes' : '🤝 Create Affiliate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
