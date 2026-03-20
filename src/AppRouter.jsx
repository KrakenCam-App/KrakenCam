import React, { useState } from 'react'
import { useAuth } from './components/AuthProvider.jsx'
import LoginPage from './components/LoginPage.jsx'
import SignupPage from './components/SignupPage.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import App from './jobsite-reporter.jsx'
import AdminRoute from './components/admin/AdminRoute.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'
import BillingDashboard from './components/BillingDashboard.jsx'

export default function AppRouter() {
  const { session, loading } = useAuth()
  const [page, setPage] = useState('login')
  const isAdmin = window.location.pathname.startsWith('/admin')
  const isBilling = window.location.pathname === '/billing'

  // If already logged in, go straight to app
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a', color: '#fff', fontSize: 18
      }}>
        Loading...
      </div>
    )
  }

  // /admin route — protected by AdminRoute
  if (isAdmin) {
    if (!session) {
      return <LoginPage onSignup={() => setPage('signup')} onForgotPassword={() => setPage('forgot')} />
    }
    return <AdminRoute><AdminDashboard /></AdminRoute>
  }

  // /billing route — requires session
  if (isBilling && session) {
    return <BillingDashboard onNavigate={(path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }} />
  }

  // Logged in → show the main app
  if (session) {
    return <App />
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
