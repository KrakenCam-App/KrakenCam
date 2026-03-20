import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from './components/AuthProvider.jsx'
import LoginPage from './components/LoginPage.jsx'
import SignupPage from './components/SignupPage.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import App from './jobsite-reporter.jsx'

export default function AppRouter() {
  const { session, loading } = useContext(AuthContext)
  const [page, setPage] = useState('login')

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
