/**
 * AdminDashboard.jsx
 * Main admin shell with collapsible sidebar navigation.
 * Dark theme: #0f0f0f bg, #1a1a1a cards, #00d4ff accent.
 */

import React, { useState } from 'react'
import AdminOverview from './AdminOverview.jsx'
import AdminOrganizations from './AdminOrganizations.jsx'
import AdminDiscountCodes from './AdminDiscountCodes.jsx'
import AdminEnterprise from './AdminEnterprise.jsx'
import AdminAnalytics from './AdminAnalytics.jsx'
import AdminSettings from './AdminSettings.jsx'

const NAV_ITEMS = [
  { id: 'overview',      label: 'Overview',        icon: '📊' },
  { id: 'organizations', label: 'Organizations',    icon: '🏢' },
  { id: 'analytics',    label: 'Analytics',        icon: '📈' },
  { id: 'enterprise',   label: 'Enterprise',       icon: '💎' },
  { id: 'discounts',    label: 'Discount Codes',   icon: '🏷️' },
  { id: 'settings',     label: 'Settings',         icon: '⚙️' },
]

const S = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: 'transparent',
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
    color: '#444',
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
  },
}

const SETTINGS_PANEL_STYLE = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
}
const SETTINGS_BOX_STYLE = {
  background: 'rgba(10,20,40,0.7)',
  border: '1px solid #2a2a2a',
  borderRadius: 12,
  padding: '28px 32px',
  minWidth: 360,
  maxWidth: 480,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

function SettingsPanel({ onClose }) {
  return (
    <div style={SETTINGS_PANEL_STYLE} onClick={onClose}>
      <div style={SETTINGS_BOX_STYLE} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚙️ Admin Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ color: '#666', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 12, color: '#aaa', fontWeight: 600 }}>Panel Info</div>
          <div>This is the KrakenCam Super Admin console.</div>
          <div style={{ marginTop: 8 }}>Access is restricted to users with <code style={{ color: '#00d4ff', background: 'rgba(5,10,25,0.8)', padding: '1px 6px', borderRadius: 4 }}>super_admin</code> role.</div>
        </div>
        <div style={{ background: 'rgba(5,10,25,0.8)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#555' }}>
          <div style={{ color: '#444', fontWeight: 600, marginBottom: 6 }}>Environment</div>
          <div>Supabase project: nszoateefidwhhsyexjd</div>
          <div>Version: 1.0.0</div>
        </div>
        <div style={{ color: '#4ec9b0', fontSize: 12, fontStyle: 'italic' }}>
          ✓ Additional settings (email templates, webhook config, etc.) coming soon.
        </div>
        <button
          onClick={onClose}
          style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 7, color: '#00d4ff', padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const activeItem = NAV_ITEMS.find(n => n.id === activeSection)

  function renderSection() {
    switch (activeSection) {
      case 'overview':      return <AdminOverview />
      case 'organizations': return <AdminOrganizations />
      case 'analytics':     return <AdminAnalytics />
      case 'enterprise':    return <AdminEnterprise />
      case 'discounts':     return <AdminDiscountCodes />
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

        <div
          style={{ ...S.sidebarFooter(sidebarOpen), cursor: 'pointer' }}
          onClick={() => setActiveSection('settings')}
          title="Admin Settings"
        >
          <span style={{ fontSize: 13 }}>⚙️</span>
          <span style={S.navLabel(sidebarOpen)}>Super Admin</span>
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
