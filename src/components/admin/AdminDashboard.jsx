/**
 * AdminDashboard.jsx
 * KrakenCam Super Admin Console — modernized shell.
 *
 * Scroll fix: root is height:100vh (not minHeight), main is overflow:hidden,
 * content is flex:1 + overflowY:auto → proper inner scroll on every page.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import AdminOverview      from './AdminOverview.jsx'
import AdminOrganizations from './AdminOrganizations.jsx'
import AdminDiscountCodes from './AdminDiscountCodes.jsx'
import AdminEnterprise    from './AdminEnterprise.jsx'
import AdminAnalytics     from './AdminAnalytics.jsx'
import AdminSettings      from './AdminSettings.jsx'
import AdminAuditLog      from './AdminAuditLog.jsx'
import AdminPricing       from './AdminPricing.jsx'
import AdminBilling       from './AdminBilling.jsx'
import AdminSupport       from './AdminSupport.jsx'
import AdminTrials        from './AdminTrials.jsx'
import AdminEmailBlast    from './AdminEmailBlast.jsx'
import AdminFeatureFlags  from './AdminFeatureFlags.jsx'
import AdminReferrals     from './AdminReferrals.jsx'
import AdminReleases      from './AdminReleases.jsx'
import AdminUsers         from './AdminUsers.jsx'
import AdminHealth        from './AdminHealth.jsx'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'overview',   label: 'Dashboard',     icon: '▦' },
      { id: 'analytics',  label: 'Analytics',     icon: '↗' },
      { id: 'health',     label: 'System Health', icon: '◎' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { id: 'organizations', label: 'Organizations', icon: '⊡' },
      { id: 'users',         label: 'Users',         icon: '◻' },
      { id: 'support',       label: 'Support',       icon: '⊙' },
      { id: 'trials',        label: 'Trials',        icon: '◷' },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { id: 'billing',    label: 'Billing',    icon: '◈' },
      { id: 'pricing',    label: 'Pricing',    icon: '$' },
      { id: 'discounts',  label: 'Discounts',  icon: '%' },
      { id: 'enterprise', label: 'Enterprise', icon: '◆' },
      { id: 'referrals',  label: 'Referrals',  icon: '⤷' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { id: 'email_blast',   label: 'Email Blast',   icon: '✉' },
      { id: 'feature_flags', label: 'Feature Flags', icon: '⚑' },
      { id: 'releases',      label: 'Releases',      icon: '◉' },
      { id: 'settings',      label: 'Settings',      icon: '⚙' },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'audit_log', label: 'Audit Log', icon: '≡' },
    ],
  },
]

const C = {
  bg: '#06080f', sidebar: '#04060c', sidebarLine: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.07)', accent: '#3b82f6',
  accentSoft: 'rgba(59,130,246,0.1)', text: '#e2e8f0',
  muted: '#94a3b8', faint: '#475569',
}

const S = {
  root: {
    display: 'flex', height: '100vh', overflow: 'hidden',
    background: C.bg, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    color: C.text, fontSize: 14,
  },
  sidebar: (open) => ({
    width: open ? 220 : 52, height: '100vh', background: C.sidebar,
    borderRight: `1px solid ${C.sidebarLine}`, display: 'flex',
    flexDirection: 'column', transition: 'width 0.2s cubic-bezier(.4,0,.2,1)',
    overflow: 'hidden', flexShrink: 0, zIndex: 10,
  }),
  sbHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 12px', height: 56, borderBottom: `1px solid ${C.sidebarLine}`, flexShrink: 0,
  },
  nav: { flex: 1, overflowY: 'auto', padding: '8px 0 16px', scrollbarWidth: 'none' },
  navGroupLabel: (open) => ({
    fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
    color: C.faint, padding: open ? '12px 14px 4px' : '0',
    opacity: open ? 1 : 0, height: open ? 'auto' : 0, overflow: 'hidden',
    transition: 'opacity 0.15s', whiteSpace: 'nowrap',
  }),
  navItem: (active, open) => ({
    display: 'flex', alignItems: 'center', gap: 9,
    padding: open ? '8px 14px' : '10px 0',
    justifyContent: open ? 'flex-start' : 'center',
    cursor: 'pointer', background: active ? C.accentSoft : 'transparent',
    borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
    color: active ? C.accent : C.muted, fontWeight: active ? 600 : 400,
    fontSize: 13, transition: 'all 0.12s', userSelect: 'none',
    whiteSpace: 'nowrap', marginRight: open ? 8 : 2,
    borderRadius: open ? '0 6px 6px 0' : 0,
  }),
  navIcon: { fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 },
  navLabel: (open) => ({ opacity: open ? 1 : 0, transition: 'opacity 0.1s', overflow: 'hidden', flex: 1 }),
  sbFoot: (open) => ({
    borderTop: `1px solid ${C.sidebarLine}`,
    padding: open ? '12px 14px' : '12px 6px',
    flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
  }),
  main: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', minWidth: 0,
  },
  topbar: {
    display: 'flex', alignItems: 'center', padding: '0 24px',
    height: 56, borderBottom: `1px solid ${C.border}`,
    background: C.bg, gap: 12, flexShrink: 0,
  },
  content: {
    flex: 1, overflowY: 'auto', padding: '28px 32px 48px',
    background: C.bg, scrollbarWidth: 'thin', scrollbarColor: `${C.faint} transparent`,
  },
}

export default function AdminDashboard() {
  const [active,     setActive]     = useState('overview')
  const [open,       setOpen]       = useState(true)
  const [adminName,  setAdminName]  = useState('Admin')
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setAdminEmail(user.email || '')
      supabase.from('profiles').select('first_name,last_name').eq('user_id', user.id).single()
        .then(({ data }) => {
          if (data?.first_name) setAdminName(`${data.first_name}${data.last_name ? ' ' + data.last_name : ''}`)
        })
    })
  }, [])

  useEffect(() => {
    const handler = (e) => setActive(e.detail)
    window.addEventListener('kc-admin-nav', handler)
    return () => window.removeEventListener('kc-admin-nav', handler)
  }, [])

  const signOut = () => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/' }
  const initials = adminName.split(' ').map(p => p[0] || '').slice(0, 2).join('').toUpperCase()
  const activeItem = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === active)

  function renderSection() {
    switch (active) {
      case 'overview':      return <AdminOverview />
      case 'analytics':     return <AdminAnalytics />
      case 'health':        return <AdminHealth />
      case 'organizations': return <AdminOrganizations />
      case 'users':         return <AdminUsers />
      case 'support':       return <AdminSupport />
      case 'trials':        return <AdminTrials />
      case 'billing':       return <AdminBilling />
      case 'pricing':       return <AdminPricing />
      case 'discounts':     return <AdminDiscountCodes />
      case 'enterprise':    return <AdminEnterprise />
      case 'referrals':     return <AdminReferrals />
      case 'email_blast':   return <AdminEmailBlast />
      case 'feature_flags': return <AdminFeatureFlags />
      case 'releases':      return <AdminReleases />
      case 'settings':      return <AdminSettings />
      case 'audit_log':     return <AdminAuditLog />
      default:              return <AdminOverview />
    }
  }

  return (
    <div style={S.root}>
      <style>{`
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:#4a5568}
      `}</style>

      {/* Sidebar */}
      <aside style={S.sidebar(open)}>
        <div style={S.sbHead}>
          <div style={{ display:'flex', alignItems:'center', gap:9, overflow:'hidden', flex:1 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>🦑</span>
            {open && (
              <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.accent, letterSpacing:.3, whiteSpace:'nowrap' }}>KrakenCam</span>
                <span style={{ fontSize:9, fontWeight:700, color:C.faint, letterSpacing:1, textTransform:'uppercase' }}>Admin Console</span>
              </div>
            )}
          </div>
          <button
            style={{ background:'none', border:'none', color:C.faint, cursor:'pointer', fontSize:16, padding:'4px 6px', flexShrink:0 }}
            onClick={() => setOpen(o => !o)}
            title={open ? 'Collapse' : 'Expand'}
          >
            {open ? '‹' : '›'}
          </button>
        </div>

        <nav style={S.nav}>
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div style={S.navGroupLabel(open)}>{group.label}</div>
              {group.items.map(item => (
                <div
                  key={item.id}
                  style={S.navItem(active === item.id, open)}
                  onClick={() => setActive(item.id)}
                  title={!open ? item.label : undefined}
                >
                  <span style={S.navIcon}>{item.icon}</span>
                  <span style={S.navLabel(open)}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div style={S.sbFoot(open)}>
          <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden', justifyContent: open ? 'flex-start' : 'center' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
              {initials || '?'}
            </div>
            {open && (
              <div style={{ overflow:'hidden', flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{adminName}</div>
                <div style={{ fontSize:10, color:C.faint, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{adminEmail}</div>
              </div>
            )}
          </div>
          <button
            style={{ display:'flex', alignItems:'center', justifyContent: open ? 'flex-start' : 'center', gap:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:6, color:'#f87171', fontSize:11, fontWeight:600, cursor:'pointer', padding: open ? '6px 10px' : '6px 8px', width:'100%' }}
            onClick={signOut}
          >
            <span>⏏</span>
            {open && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={S.main}>
        <div style={S.topbar}>
          <span style={{ fontSize:15, fontWeight:600, color:C.text, flex:1 }}>{activeItem?.label || 'Dashboard'}</span>
          <span style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.22)', color:'#60a5fa', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, letterSpacing:.8, textTransform:'uppercase' }}>Super Admin</span>
          <a href="/" style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:7, color:C.muted, padding:'6px 12px', fontSize:12, cursor:'pointer', fontWeight:500, textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>← View App</a>
        </div>
        <div style={S.content}>
          {renderSection()}
        </div>
      </div>
    </div>
  )
}
