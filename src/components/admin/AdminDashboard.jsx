/**
 * AdminDashboard.jsx
 * Main admin shell with collapsible sidebar navigation.
 * Dark theme: #0f0f0f bg, #1a1a1a cards, #00d4ff accent.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import AdminOverview from './AdminOverview.jsx'
import AdminOrganizations from './AdminOrganizations.jsx'
import AdminDiscountCodes from './AdminDiscountCodes.jsx'
import AdminEnterprise from './AdminEnterprise.jsx'
import AdminAnalytics from './AdminAnalytics.jsx'
import AdminSettings from './AdminSettings.jsx'
import AdminAuditLog from './AdminAuditLog.jsx'
import AdminPricing from './AdminPricing.jsx'
import AdminBilling from './AdminBilling.jsx'
import AdminSupport from './AdminSupport.jsx'
import AdminTrials from './AdminTrials.jsx'
import AdminEmailBlast from './AdminEmailBlast.jsx'
import AdminFeatureFlags from './AdminFeatureFlags.jsx'
import AdminReferrals from './AdminReferrals.jsx'
import AdminReleases from './AdminReleases.jsx'

const NAV_ITEMS = [
  { id: 'overview',      label: 'Overview',        icon: '📊' },
  { id: 'billing',       label: 'Billing',         icon: '💳' },
  { id: 'trials',        label: 'Trials',          icon: '⏳' },
  { id: 'organizations', label: 'Organizations',   icon: '🏢' },
  { id: 'support',       label: 'Support',         icon: '🎧' },
  { id: 'email_blast',   label: 'Email Blast',     icon: '📨' },
  { id: 'feature_flags', label: 'Feature Flags',   icon: '🚩' },
  { id: 'referrals',     label: 'Referrals',       icon: '🤝' },
  { id: 'releases',      label: 'Release Notes',   icon: '📦' },
  { id: 'analytics',     label: 'Analytics',       icon: '📈' },
  { id: 'enterprise',    label: 'Enterprise',      icon: '💎' },
  { id: 'discounts',     label: 'Discount Codes',  icon: '🏷️' },
  { id: 'pricing',       label: 'Pricing',         icon: '💰' },
  { id: 'audit_log',     label: 'Audit Log',       icon: '📋' },
  { id: 'settings',      label: 'Settings',        icon: '⚙️' },
]

const S = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0a0a0a',
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    color: '#e8e8e8',
  },
  // ── Sidebar ──
  sidebar: (open) => ({
    width: open ? 220 : 60,
    minHeight: '100vh',
    background: 'rgba(5, 10, 20, 0.85)',
    borderRight: '1px solid rgba(30, 60, 120, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.22s ease',
    overflow: 'hidden',
    flexShrink: 0,
    zIndex: 100,
  }),
  sidebarTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 14px 14px',
    borderBottom: '1px solid rgba(30,60,120,0.3)',
    gap: 8,
    minHeight: 60,
  },
  logo: (open) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }),
  logoIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  logoText: (open) => ({
    color: '#00d4ff',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.5,
    opacity: open ? 1 : 0,
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  }),
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 4px',
    flexShrink: 0,
    lineHeight: 1,
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 0',
    gap: 2,
  },
  navItem: (active, open) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: open ? '10px 16px' : '10px 0',
    justifyContent: open ? 'flex-start' : 'center',
    cursor: 'pointer',
    borderRadius: 0,
    background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
    borderLeft: active ? '3px solid #00d4ff' : '3px solid transparent',
    color: active ? '#00d4ff' : '#aaa',
    fontWeight: active ? 600 : 400,
    fontSize: 13,
    transition: 'all 0.15s',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }),
  navIcon: { fontSize: 16, flexShrink: 0 },
  navLabel: (open) => ({
    opacity: open ? 1 : 0,
    transition: 'opacity 0.12s',
    overflow: 'hidden',
  }),
  sidebarFooter: (open) => ({
    padding: open ? '14px 16px' : '14px 0',
    borderTop: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: open ? 'flex-start' : 'center',
    gap: 8,
    fontSize: 11,
    color: '#7a8a9a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }),
  // ── Main content ──
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    height: 56,
    borderBottom: '1px solid #1e1e1e',
    background: '#0f0f0f',
    gap: 12,
    flexShrink: 0,
  },
  topbarTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e8e8',
  },
  topbarBadge: {
    background: 'rgba(0,212,255,0.12)',
    color: '#00d4ff',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    padding: '28px 28px',
    overflowY: 'auto',
    background: '#0a0a0a',
  },
}

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const handler = (e) => setActiveSection(e.detail)
    window.addEventListener('kc-admin-nav', handler)
    return () => window.removeEventListener('kc-admin-nav', handler)
  }, [])

  const signOut = () => {
    // Clear everything Supabase stored and redirect to login
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = '/'
  }

  const activeItem = NAV_ITEMS.find(n => n.id === activeSection)

  function renderSection() {
    switch (activeSection) {
      case 'overview':      return <AdminOverview />
      case 'billing':       return <AdminBilling />
      case 'trials':        return <AdminTrials />
      case 'organizations': return <AdminOrganizations />
      case 'support':       return <AdminSupport />
      case 'email_blast':   return <AdminEmailBlast />
      case 'feature_flags': return <AdminFeatureFlags />
      case 'referrals':     return <AdminReferrals />
      case 'releases':      return <AdminReleases />
      case 'analytics':     return <AdminAnalytics />
      case 'enterprise':    return <AdminEnterprise />
      case 'discounts':     return <AdminDiscountCodes />
      case 'pricing':       return <AdminPricing />
      case 'audit_log':     return <AdminAuditLog />
      case 'settings':      return <AdminSettings />
      default:              return <AdminOverview />
    }
  }

  return (
    <div style={S.root}>
      {/* Sidebar */}
      <aside style={S.sidebar(sidebarOpen)}>
        <div style={S.sidebarTop}>
          <div style={S.logo(sidebarOpen)}>
            <span style={S.logoIcon}>🦑</span>
            <span style={S.logoText(sidebarOpen)}>KrakenCam Admin</span>
          </div>
          <button style={S.toggleBtn} onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav style={S.nav}>
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              style={S.navItem(activeSection === item.id, sidebarOpen)}
              onClick={() => setActiveSection(item.id)}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span style={S.navIcon}>{item.icon}</span>
              <span style={S.navLabel(sidebarOpen)}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ ...S.sidebarFooter(sidebarOpen), flexDirection:'column', gap:8, alignItems: sidebarOpen?'flex-start':'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize: 13 }}>🦑</span>
            <span style={S.navLabel(sidebarOpen)}>KrakenCam Admin</span>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:6, color:'#f87171', fontSize:11, fontWeight:600, cursor:'pointer', padding: sidebarOpen?'5px 10px':'5px 8px', width: sidebarOpen?'100%':'auto', justifyContent:'center' }}
          >
            <span>⏏</span>
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div style={S.main}>
        {/* Top bar */}
        <div style={S.topbar}>
          <span style={S.topbarTitle}>
            {activeItem?.icon} {activeItem?.label}
          </span>
          <span style={S.topbarBadge}>Internal</span>
        </div>

        {/* Page content */}
        <div style={S.content}>
          {renderSection()}
        </div>
      </div>

    </div>
  )
}
