/**
 * LoginPage.jsx
 * Email/password login with Supabase Auth.
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage({ onSignup, onForgotPassword }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Invalid email or password. Please try again.');
    }
    // On success, AuthProvider will update session and AppRouter will redirect

    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/krakencam-logo.svg" alt="KrakenCam" />
        </div>

        <h1>Sign In</h1>
        <p className="auth-subtitle">Welcome back to KrakenCam</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-links">
          <button className="btn-link" onClick={onForgotPassword}>Forgot your password?</button>
        </div>

        <div className="auth-divider">
          <span>Don't have an account?</span>
        </div>

        <button className="btn-secondary btn-full" onClick={onSignup}>
          Start Free Trial
        </button>
      </div>
    </div>
  );
}
