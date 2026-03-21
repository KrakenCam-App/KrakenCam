/**
 * AdminSupport.jsx
 * Support tools: user impersonation, org notes/flags, quick org lookup.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const S = {
  card: { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'20px 22px', marginBottom:16 },
  sectionTitle: { fontSize:14, fontWeight:600, color:'#ccc', marginBottom:12, letterSpacing:.3 },
  input: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'9px 12px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  btn: { background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.3)', color:'#60a5fa', borderRadius:7, padding:'8px 16px', fontSize:13, cursor:'pointer', fontWeight:600 },
  dangerBtn: { background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', color:'#f87171', borderRadius:7, padding:'8px 16px', fontSize:13, cursor:'pointer', fontWeight:600 },
  greenBtn: { background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', color:'#4ade80', borderRadius:7, padding:'8px 16px', fontSize:13, cursor:'pointer', fontWeight:600 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'9px 14px', background:'#111', color:'#555', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:.6, borderBottom:'1px solid #222' },
  td: { padding:'10px 14px', borderBottom:'1px solid #1e1e1e', color:'#ccc', verticalAlign:'middle' },
  badge: (color) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${color}22`, color, border:`1px solid ${color}44` }),
  flag: (color) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${color}22`, color }),
  textarea: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'9px 12px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', resize:'vertical', fontFamily:'Inter,sans-serif', minHeight:72 },
  noteItem: { background:'rgba(255,255,255,.03)', border:'1px solid #252525', borderRadius:8, padding:'10px 14px', marginBottom:8 },
}

const FLAG_OPTIONS = [
  { value:'none',      label:'No flag',    color:'#555' },
  { value:'at_risk',   label:'⚠️ At risk',  color:'#fbbf24' },
  { value:'vip',       label:'⭐ VIP',      color:'#c792ea' },
  { value:'follow_up', label:'📌 Follow up',color:'#60a5fa' },
  { value:'churned',   label:'💔 Churned',  color:'#f87171' },
]

function fmtDate(s) { if(!s) return '—'; return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) }

export default function AdminSupport() {
  const [search,      setSearch]      = useState('')
  const [orgs,        setOrgs]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState(null) // org object
  const [users,       setUsers]       = useState([])
  const [notes,       setNotes]       = useState([])
  const [newNote,     setNewNote]     = useState('')
  const [savingNote,  setSavingNote]  = useState(false)
  const [flag,        setFlag]        = useState('none')
  const [savingFlag,  setSavingFlag]  = useState(false)
  const [impersonating, setImpersonating] = useState(null)
  const [impStatus,   setImpStatus]   = useState(null)

  // Search orgs
  const searchOrgs = useCallback(async (q) => {
    if (!q.trim()) { setOrgs([]); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_search_orgs', { search_term: q })
    console.log('[Support search]', { q, data, error })
    const results = Array.isArray(data) ? data : data ? [data] : []
    setOrgs(results)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchOrgs(search), 300)
    return () => clearTimeout(t)
  }, [search, searchOrgs])

  // Load org detail (users + notes + flag)
  const selectOrg = async (org) => {
    setSelected(org)
    setUsers([]); setNotes([]); setFlag('none')
    // Load users
    const { data: u } = await supabase.rpc('admin_get_org_users', { p_org_id: org.id })
    setUsers(u || [])
    const { data: n } = await supabase.rpc('admin_get_org_notes', { p_org_id: org.id })
    setNotes(n || [])
    const { data: f } = await supabase.rpc('admin_get_org_flag', { p_org_id: org.id })
    setFlag(f || 'none')
  }

  const addNote = async () => {
    if (!newNote.trim() || !selected) return
    setSavingNote(true)
    const { data: me } = await supabase.auth.getUser()
    await supabase.from('org_support_notes').insert({
      org_id: selected.id,
      note: newNote.trim(),
      admin_id: me?.user?.id,
    })
    setNewNote('')
    const { data: n } = await supabase.rpc('admin_get_org_notes', { p_org_id: selected.id })
    setNotes(n || [])
    setSavingNote(false)
  }

  const saveFlag = async (val) => {
    if (!selected) return
    setSavingFlag(true)
    await supabase.from('org_flags').upsert({ org_id: selected.id, flag: val }, { onConflict: 'org_id' })
    setFlag(val)
    setSavingFlag(false)
  }

  const impersonate = async (user) => {
    setImpersonating(user.user_id)
    setImpStatus(null)
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { user_id: user.user_id }
      })
      if (error || !data?.link) throw new Error(error?.message || 'No link returned')
      setImpStatus({ ok: true, link: data.link, name: user.full_name || user.email })
    } catch (e) {
      setImpStatus({ ok: false, error: e.message })
    }
    setImpersonating(null)
  }

  const TIER_COLOR = { capture_i:'#4ec9b0', intelligence_ii:'#00d4ff', command_iii:'#c792ea' }
  const TIER_LABEL = { capture_i:'Capture I', intelligence_ii:'Intelligence II', command_iii:'Command III' }
  const STATUS_COLOR = { active:'#4ec9b0', trialing:'#fbbf24', past_due:'#f87171', cancelled:'#666', suspended:'#f87171' }

  return (
    <div>
      {/* ── Search ── */}
      <div style={S.card}>
        <div style={S.sectionTitle}>🔍 Organisation Lookup</div>
        <input
          style={S.input}
          placeholder="Search by organization name…"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null) }}
          autoFocus
        />
        {loading && <div style={{ fontSize:12, color:'#555', marginTop:8 }}>Searching…</div>}
        {!loading && search && orgs.length === 0 && <div style={{ fontSize:12, color:'#555', marginTop:8 }}>No results</div>}
        {orgs.length > 0 && (
          <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
            {orgs.map(o => (
              <div key={o.id}
                onClick={() => selectOrg(o)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:8, background: selected?.id===o.id ? 'rgba(0,212,255,.08)' : 'rgba(255,255,255,.03)', border:`1px solid ${selected?.id===o.id ? '#00d4ff44' : '#252525'}`, cursor:'pointer' }}
              >
                <div>
                  <span style={{ fontWeight:600, color:'#e8e8e8', fontSize:13 }}>{o.name}</span>
                  <span style={{ fontSize:11, color:'#555', marginLeft:8 }}>/{o.slug}</span>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <span style={S.badge(TIER_COLOR[o.subscription_tier]||'#888')}>{TIER_LABEL[o.subscription_tier]||o.subscription_tier}</span>
                  <span style={S.badge(STATUS_COLOR[o.subscription_status]||'#555')}>{o.subscription_status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Org detail panel ── */}
      {selected && (
        <>
          {/* Flag */}
          <div style={S.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={S.sectionTitle}>🚩 Account Flag — {selected.name}</div>
              {savingFlag && <span style={{ fontSize:12, color:'#555' }}>Saving…</span>}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {FLAG_OPTIONS.map(f => (
                <button key={f.value}
                  onClick={() => saveFlag(f.value)}
                  style={{ ...S.btn, background: flag===f.value ? `${f.color}33` : 'rgba(255,255,255,.04)', border:`1px solid ${flag===f.value ? f.color : '#333'}`, color: flag===f.value ? f.color : '#888', fontWeight: flag===f.value ? 700 : 400 }}
                >{f.label}</button>
              ))}
            </div>
          </div>

          {/* Users + impersonation */}
          <div style={S.card}>
            <div style={S.sectionTitle}>👥 Users — {selected.name}</div>
            {users.length === 0
              ? <div style={{ fontSize:13, color:'#555' }}>No users found</div>
              : <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Name</th>
                    <th style={S.th}>Email</th>
                    <th style={S.th}>Role</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Impersonate</th>
                  </tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={S.td}>{u.full_name || '—'}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:12 }}>{u.email}</td>
                        <td style={S.td}><span style={S.badge(u.role==='super_admin'?'#c792ea':u.role==='admin'?'#00d4ff':'#888')}>{u.role}</span></td>
                        <td style={S.td}><span style={S.badge(u.is_active?'#4ade80':'#f87171')}>{u.is_active?'Active':'Inactive'}</span></td>
                        <td style={S.td}>
                          <button style={S.btn} disabled={!!impersonating} onClick={() => impersonate(u)}>
                            {impersonating===u.user_id ? '⏳' : '👁 View as user'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
            {impStatus && (
              <div style={{ marginTop:12, padding:'12px 14px', borderRadius:8, background: impStatus.ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', border:`1px solid ${impStatus.ok ? '#22c55e44' : '#ef444444'}` }}>
                {impStatus.ok ? (
                  <>
                    <div style={{ fontSize:13, color:'#4ade80', fontWeight:600, marginBottom:6 }}>✓ Impersonation link ready for {impStatus.name}</div>
                    <a href={impStatus.link} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'#60a5fa', wordBreak:'break-all' }}>{impStatus.link}</a>
                    <div style={{ fontSize:11, color:'#555', marginTop:6 }}>⚠️ Link expires in 1 hour. Opens in a new tab logged in as this user.</div>
                  </>
                ) : (
                  <div style={{ fontSize:13, color:'#f87171' }}>✗ Impersonation failed: {impStatus.error}<br/><span style={{ fontSize:11, color:'#555' }}>Make sure the admin-impersonate edge function is deployed.</span></div>
                )}
              </div>
            )}
          </div>

          {/* Admin notes */}
          <div style={S.card}>
            <div style={S.sectionTitle}>📝 Admin Notes — {selected.name}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
              {notes.length === 0 && <div style={{ fontSize:13, color:'#555' }}>No notes yet. Add one below.</div>}
              {notes.map(n => (
                <div key={n.id} style={S.noteItem}>
                  <div style={{ fontSize:13, color:'#e8e8e8', lineHeight:1.6 }}>{n.note}</div>
                  <div style={{ fontSize:11, color:'#444', marginTop:4 }}>{fmtDate(n.created_at)}</div>
                </div>
              ))}
            </div>
            <textarea style={S.textarea} placeholder="Add a support note… (e.g. Spoke to owner, upgrading next month)" value={newNote} onChange={e => setNewNote(e.target.value)} />
            <div style={{ marginTop:8 }}>
              <button style={S.btn} disabled={savingNote || !newNote.trim()} onClick={addNote}>
                {savingNote ? '⏳ Saving…' : '+ Add Note'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
