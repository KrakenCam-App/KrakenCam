import React, { useState, useEffect } from 'react'
import { useAuth } from './components/AuthProvider.jsx'
import LoginPage from './components/LoginPage.jsx'
import SignupPage from './components/SignupPage.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import App from './jobsite-reporter.jsx'
import AdminRoute from './components/admin/AdminRoute.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'
import BillingDashboard from './components/BillingDashboard.jsx'
import SubscriptionGate from './components/SubscriptionGate.jsx'
import AcceptInvite from './components/AcceptInvite.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import AnnouncementPopup from './components/AnnouncementPopup.jsx'
import ClientPortalPage from './components/ClientPortalPage.jsx'
import { FlagsProvider } from './lib/featureFlags.jsx'
import WhatsNewPopup from './components/WhatsNewPopup.jsx'
import { supabase } from './lib/supabase.js'

function MaintenanceScreen({ message }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0c10', color: '#e8e8e8',
      fontFamily: 'Inter, sans-serif', flexDirection: 'column', gap: 24,
      padding: '0 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 56 }}>🔧</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
        Under Maintenance
      </div>
      <div style={{
        fontSize: 15, color: '#8b9ab8', maxWidth: 420, lineHeight: 1.7,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '18px 24px',
      }}>
        {message || 'We are performing scheduled maintenance. We\'ll be back shortly.'}
      </div>
      <div style={{ fontSize: 13, color: '#4a5568', marginTop: 8 }}>
        — The KrakenCam Team
      </div>
    </div>
  )
}

export default function AppRouter() {
  const { session, loading } = useAuth()
  const [page, setPage] = useState('login')
  const [isRecovery, setIsRecovery] = useState(false)
  const [maintenance, setMaintenance] = useState(null) // null=loading, false=off, {message}=on
  const [userRole,    setUserRole]    = useState('user')
  const [orgId,       setOrgId]       = useState(null)
  const [orgTier,     setOrgTier]     = useState(null)
  const isAdmin = window.location.pathname.startsWith('/admin')
  const isBilling = window.location.pathname === '/billing'
  const isAcceptInvite = window.location.pathname === '/accept-invite'
  const portalMatch = window.location.pathname.match(/^\/client-portal\/(.+)$/)
  const portalSlug = portalMatch ? portalMatch[1] : null

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('type=email_change')) {
      setIsRecovery(true)
    }
    // Also listen for auth state change
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => authSub.unsubscribe()
  }, [])

  // Check maintenance mode — hard timeout so a slow/missing RPC never blocks the app
  useEffect(() => {
    const timeout = setTimeout(() => setMaintenance(false), 3000) // give up after 3s
    supabase.rpc('get_maintenance_mode')
      .then(({ data, error }) => {
        clearTimeout(timeout)
        if (error || !data) { setMaintenance(false); return; }
        setMaintenance(data.enabled ? { message: data.message || '' } : false);
      })
      .catch(() => { clearTimeout(timeout); setMaintenance(false); });
    return () => clearTimeout(timeout)
  }, [])

  // Fetch user profile + org tier for announcements and feature flags
  useEffect(() => {
    if (!session) return
    supabase.from('profiles')
      .select('role, organization_id, organizations(subscription_tier)')
      .eq('user_id', session.user.id).single()
      .then(({ data }) => {
        if (data?.role)            setUserRole(data.role)
        if (data?.organization_id) setOrgId(data.organization_id)
        if (data?.organizations?.subscription_tier) setOrgTier(data.organizations.subscription_tier)
      })
      .catch(() => {})
  }, [session])

  // Client portal — fully public, no auth needed
  if (portalSlug) {
    return <ClientPortalPage slug={portalSlug} />
  }

  // Accept invite — show before auth checks
  if (isAcceptInvite) {
    return <AcceptInvite />
  }

  // Password recovery — show before auth checks
  if (isRecovery) {
    return (
      <ResetPassword
        onDone={() => {
          setIsRecovery(false)
          window.location.hash = ''
        }}
      />
    )
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0c10', color: '#6b7280', fontSize: 16,
        flexDirection: 'column', gap: 16, fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #1e2638',
          borderTop: '3px solid #2563eb', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span>Loading...</span>
      </div>
    )
  }

  // Maintenance mode — admins on /admin bypass it, everyone else sees the screen
  if (maintenance && !isAdmin) {
    return <MaintenanceScreen message={maintenance.message} />
  }

  // /admin route — protected by AdminRoute
  if (isAdmin) {
    if (!session) {
      if (page === 'forgot') {
        return <ForgotPassword onBack={() => setPage('login')} />
      }
      return <LoginPage onSignup={null} onForgotPassword={() => setPage('forgot')} />
    }
    return (
      <FlagsProvider orgTier={orgTier} orgId={orgId}>
        <AnnouncementPopup userRole={userRole} />
        <AdminRoute><AdminDashboard /></AdminRoute>
      </FlagsProvider>
    )
  }

  // /billing route — requires session
  if (isBilling && session) {
    return <BillingDashboard onNavigate={(path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }} />
  }

  // Logged in → show the main app (wrapped in SubscriptionGate)
  if (session) {
    return (
      <FlagsProvider orgTier={orgTier} orgId={orgId}>
        <AnnouncementPopup userRole={userRole} />
        <WhatsNewPopup />
        <SubscriptionGate>
          <App />
        </SubscriptionGate>
      </FlagsProvider>
    )
  }

  // Not logged in → show auth pages
  if (page === 'login') {
    return (
      <LoginPage
        onSignup={() => setPage('signup')}
        onForgotPassword={() => setPage('forgot')}
      />
    )
  }

  if (page === 'signup') {
    return (
      <SignupPage
        onLogin={() => setPage('login')}
      />
    )
  }

  if (page === 'forgot') {
    return (
      <ForgotPassword
        onBack={() => setPage('login')}
      />
    )
  }

  return <LoginPage onSignup={() => setPage('signup')} onForgotPassword={() => setPage('forgot')} />
}
