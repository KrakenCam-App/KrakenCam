/**
 * AdminUsers.jsx
 * Platform-wide user management panel.
 * View, search, filter, change roles, and deactivate users across all orgs.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { adminFrom, adminUpdate } from '../../lib/adminFetch'

const ROLE_COLOR = {
  super_admin: '#c792ea',
  admin:       '#00d4ff',
  manager:     '#4ec9b0',
  user:        '#8b9ab8',
}
const TIER_COLOR = {
  capture_i:       '#4ec9b0',
  intelligence_ii: '#00d4ff',
  command_iii:     '#c792ea',
}
const TIER_LABEL = {
  capture_i: 'Capture I', intelligence_ii: 'Intelligence II', command_iii: 'Command III',
}

const S = {
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:28 },
  metaCard: { background:'#0e1117', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'16px 20px', display:'flex', flexDirection:'column', gap:4 },
  metaLabel: { fontSize:11, color:'#64748b', fontWeight:600, letterSpacing:.8, textTransform:'uppercase' },
  metaValue: (color='#3b82f6') => ({ fontSize:28, fontWeight:700, color, lineHeight:1 }),
  metaSub: { fontSize:12, color:'#64748b', marginTop:2 },

  toolbar: { display:'flex', gap:10, marginBottom:18, alignItems:'center', flexWrap:'wrap' },
  searchBox: { flex:'1 1 260px', background:'#0c1018', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e2e8f0', padding:'9px 14px', fontSize:13, outline:'none', fontFamily:"'Inter',sans-serif" },
  select: { background:'#0c1018', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#94a3b8', padding:'9px 12px', fontSize:12, outline:'none', cursor:'pointer' },

  tableWrap: { background:'#0c1018', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, overflow:'hidden' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'10px 14px', background:'rgba(255,255,255,0.03)', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:.7, borderBottom:'1px solid rgba(255,255,255,0.07)' },
  td: { padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)', color:'#cbd5e1', verticalAlign:'middle' },

  badge: (color) => ({ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${color}1a`, color, border:`1px solid ${color}33` }),

  actionBtn: { background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', color:'#60a5fa', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:600 },
  dangerBtn: { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:600 },
  warnBtn:   { background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', color:'#fbbf24', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:600 },

  empty: { textAlign:'center', padding:'48px 20px', color:'#475569', fontSize:13 },
  loadingRow: { textAlign:'center', padding:'32px', color:'#475569', fontSize:13 },

  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px' },
  modalBox: { background:'#0c1421', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'28px 26px', width:'100%', maxWidth:420 },
  modalTitle: { fontSize:16, fontWeight:700, color:'#e2e8f0', marginBottom:6 },
  modalSub: { fontSize:13, color:'#64748b', marginBottom:22, lineHeight:1.5 },
  modalLabel: { fontSize:12, color:'#94a3b8', marginBottom:6, fontWeight:500 },
  modalSelect: { width:'100%', background:'#060d1a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#e2e8f0', padding:'9px 12px', fontSize:13, outline:'none', marginBottom:18 },
  modalBtns: { display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 },
  cancelBtn: { background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, color:'#94a3b8', padding:'8px 18px', fontSize:13, cursor:'pointer' },
  confirmBtn: (danger) => ({ background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', border:`1px solid ${danger ? 'rgba(239,68,68,.35)' : 'rgba(59,130,246,.35)'}`, borderRadius:7, color: danger ? '#f87171' : '#60a5fa', padding:'8px 18px', fontSize:13, cursor:'pointer', fontWeight:600 }),

  pagination: { display:'flex', gap:8, justifyContent:'flex-end', marginTop:14, alignItems:'center' },
  pageBtn: (active) => ({ background: active ? 'rgba(59,130,246,0.15)' : 'transparent', border:`1px solid ${active ? 'rgba(59,130,246,.3)' : 'rgba(255,255,255,.1)'}`, borderRadius:6, color: active ? '#60a5fa' : '#64748b', padding:'5px 12px', fontSize:12, cursor:'pointer' }),
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

const PAGE_SIZE = 25

export default function AdminUsers() {
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [roleFilter,setRoleFilter]= useState('')
  const [page,      setPage]      = useState(0)
  const [total,     setTotal]     = useState(0)
  const [modal,     setModal]     = useState(null)  // { type, user }
  const [newRole,   setNewRole]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState(null)

  // Stat summary
  const [stats, setStats] = useState({ total:0, admins:0, managers:0, users:0 })

  const loadUsers = useCallback(async (pg = 0, q = '', role = '') => {
    setLoading(true)
    try {
      // Join organizations to get org_name and tier
      let params = `select=user_id,email,full_name,first_name,last_name,role,created_at,is_active,organization_id,organizations!organization_id(name,subscription_tier)`
      params += `&order=created_at.desc&offset=${pg * PAGE_SIZE}&limit=${PAGE_SIZE}`
      if (q) params += `&or=(email.ilike.*${encodeURIComponent(q)}*,full_name.ilike.*${encodeURIComponent(q)}*,first_name.ilike.*${encodeURIComponent(q)}*,last_name.ilike.*${encodeURIComponent(q)}*)`
      if (role) params += `&role=eq.${role}`
      const data = await adminFrom('profiles', params)
      // Flatten the nested org join
      const flat = (data || []).map(u => ({
        ...u,
        org_name: u.organizations?.name || null,
        org_tier: u.organizations?.subscription_tier || null,
      }))
      setUsers(flat)
      setTotal(flat.length)
    } catch (err) {
      console.error('AdminUsers load error:', err)
      setUsers([])
    }
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const data = await adminFrom('profiles', 'select=role')
      const all   = data || []
      const total = all.length
      const adm   = all.filter(u => u.role === 'admin' || u.role === 'super_admin').length
      const mgr   = all.filter(u => u.role === 'manager').length
      const usr   = all.filter(u => u.role === 'user').length
      setStats({ total, admins: adm, managers: mgr, users: usr })
    } catch (e) { console.warn('AdminUsers stats error:', e) }
  }, [])

  useEffect(() => {
    loadStats()
    loadUsers(0, '', '')
  }, [loadStats, loadUsers])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(0)
    loadUsers(0, e.target.value, roleFilter)
  }

  const handleRoleFilter = (e) => {
    setRoleFilter(e.target.value)
    setPage(0)
    loadUsers(0, search, e.target.value)
  }

  const openChangeRole = (user) => {
    setNewRole(user.role)
    setModal({ type: 'role', user })
    setSaveMsg(null)
  }

  const openDeactivate = (user) => {
    setModal({ type: 'deactivate', user })
    setSaveMsg(null)
  }

  const confirmChangeRole = async () => {
    if (!modal?.user) return
    setSaving(true)
    try {
      await adminUpdate('profiles', { role: newRole }, `user_id=eq.${modal.user.user_id}`)
      setSaveMsg({ ok: true, text: `Role updated to ${newRole}` })
      setUsers(prev => prev.map(u => u.user_id === modal.user.user_id ? { ...u, role: newRole } : u))
      setTimeout(() => { setModal(null); setSaveMsg(null) }, 1200)
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message })
    }
    setSaving(false)
  }

  const confirmDeactivate = async () => {
    if (!modal?.user) return
    setSaving(true)
    try {
      await adminUpdate('profiles', { role: 'suspended' }, `user_id=eq.${modal.user.user_id}`)
      setSaveMsg({ ok: true, text: 'User suspended' })
      setUsers(prev => prev.map(u => u.user_id === modal.user.user_id ? { ...u, role: 'suspended' } : u))
      setTimeout(() => { setModal(null); setSaveMsg(null); loadStats() }, 1200)
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message })
    }
    setSaving(false)
  }

  const totalPages = Math.max(1, Math.ceil(Math.max(stats.total, users.length) / PAGE_SIZE))

  return (
    <div>
      {/* Stat cards */}
      <div style={S.grid}>
        {[
          { label:'Total Users',  value: stats.total,    color:'#3b82f6', sub:'All platform users' },
          { label:'Admins',       value: stats.admins,   color:'#00d4ff', sub:'Admin + super admin' },
          { label:'Managers',     value: stats.managers, color:'#4ec9b0', sub:'Manager role' },
          { label:'Field Users',  value: stats.users,    color:'#8b9ab8', sub:'Standard user role' },
        ].map(m => (
          <div key={m.label} style={S.metaCard}>
            <div style={S.metaLabel}>{m.label}</div>
            <div style={S.metaValue(m.color)}>{m.value}</div>
            <div style={S.metaSub}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          style={S.searchBox}
          placeholder="Search by name, email, or organization…"
          value={search}
          onChange={handleSearch}
        />
        <select style={S.select} value={roleFilter} onChange={handleRoleFilter}>
          <option value="">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          style={{ ...S.actionBtn, padding:'9px 14px' }}
          onClick={() => { setPage(0); loadUsers(0, search, roleFilter) }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>User</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Role</th>
              <th style={S.th}>Organization</th>
              <th style={S.th}>Tier</th>
              <th style={S.th}>Joined</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={S.loadingRow}>Loading users…</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={7} style={S.empty}>No users found{search ? ` for "${search}"` : ''}</td></tr>
            )}
            {!loading && users.map((u, i) => {
              const name = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '—'
              const roleColor = ROLE_COLOR[u.role] || '#8b9ab8'
              const isSuspended = u.role === 'suspended'
              return (
                <tr
                  key={u.user_id || i}
                  style={{ opacity: isSuspended ? 0.5 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...S.td, fontWeight:500 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {(name[0] || u.email?.[0] || '?').toUpperCase()}
                      </div>
                      <span style={{ color:'#e2e8f0' }}>{name}</span>
                    </div>
                  </td>
                  <td style={{ ...S.td, color:'#94a3b8', fontFamily:'monospace', fontSize:12 }}>{u.email || '—'}</td>
                  <td style={S.td}><span style={S.badge(roleColor)}>{u.role || 'user'}</span></td>
                  <td style={{ ...S.td, color:'#94a3b8' }}>{u.org_name || '—'}</td>
                  <td style={S.td}>
                    {u.org_tier ? (
                      <span style={S.badge(TIER_COLOR[u.org_tier] || '#8b9ab8')}>
                        {TIER_LABEL[u.org_tier] || u.org_tier}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...S.td, color:'#64748b' }}>{fmtDate(u.created_at)}</td>
                  <td style={S.td}>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <button style={S.actionBtn} onClick={() => openChangeRole(u)}>Role</button>
                      {!isSuspended && (
                        <button style={S.warnBtn} onClick={() => openDeactivate(u)}>Suspend</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={S.pagination}>
          <span style={{ fontSize:12, color:'#64748b' }}>
            Page {page + 1} of {totalPages}
          </span>
          {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => (
            <button
              key={i}
              style={S.pageBtn(page === i)}
              onClick={() => { setPage(i); loadUsers(i, search, roleFilter) }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Role change modal */}
      {modal?.type === 'role' && (
        <div style={S.modal} onClick={() => setModal(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Change Role</div>
            <div style={S.modalSub}>
              Update role for <strong style={{ color:'#e2e8f0' }}>{[modal.user.first_name, modal.user.last_name].filter(Boolean).join(' ') || modal.user.email}</strong>
            </div>
            <div style={S.modalLabel}>New Role</div>
            <select style={S.modalSelect} value={newRole} onChange={e => setNewRole(e.target.value)}>
              <option value="user">User — Field personnel</option>
              <option value="manager">Manager — Office/project management</option>
              <option value="admin">Admin — Account holder</option>
              <option value="super_admin">Super Admin — Platform admin</option>
              <option value="suspended">Suspended — No access</option>
            </select>
            {saveMsg && (
              <div style={{ fontSize:13, color: saveMsg.ok ? '#4ade80' : '#f87171', marginBottom:12 }}>
                {saveMsg.ok ? '✓ ' : '✗ '}{saveMsg.text}
              </div>
            )}
            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button style={S.confirmBtn(false)} onClick={confirmChangeRole} disabled={saving}>
                {saving ? 'Saving…' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend modal */}
      {modal?.type === 'deactivate' && (
        <div style={S.modal} onClick={() => setModal(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Suspend User?</div>
            <div style={S.modalSub}>
              This will set <strong style={{ color:'#e2e8f0' }}>{[modal.user.first_name, modal.user.last_name].filter(Boolean).join(' ') || modal.user.email}</strong>'s role to <strong style={{ color:'#f87171' }}>suspended</strong>, blocking their access. You can re-enable them by changing their role back.
            </div>
            {saveMsg && (
              <div style={{ fontSize:13, color: saveMsg.ok ? '#4ade80' : '#f87171', marginBottom:12 }}>
                {saveMsg.ok ? '✓ ' : '✗ '}{saveMsg.text}
              </div>
            )}
            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button style={S.confirmBtn(true)} onClick={confirmDeactivate} disabled={saving}>
                {saving ? 'Suspending…' : 'Suspend User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
