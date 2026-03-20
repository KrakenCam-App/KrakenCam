/**
 * ForgotPassword.jsx
 * Sends a password reset email via Supabase Auth.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // SECURITY: Always show success message even if email doesn't exist.
    // This prevents email enumeration attacks.
    if (error) {
      console.error('[ForgotPassword] Error:', error);
    }

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/krakencam-logo.svg" alt="KrakenCam" />
          </div>
          <h1>Check Your Email</h1>
          <p className="auth-subtitle">
            If an account with <strong>{email}</strong> exists, we've sent a password
            reset link. Check your spam folder if you don't see it.
          </p>
          <div className="auth-links">
            <Link to="/login">← Back to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/krakencam-logo.svg" alt="KrakenCam" />
        </div>

        <h1>Reset Password</h1>
        <p className="auth-subtitle">
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
