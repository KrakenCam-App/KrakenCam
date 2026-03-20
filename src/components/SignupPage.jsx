/**
 * SignupPage.jsx
 *
 * New organization signup flow:
 * - Org name, admin name, email, password
 * - Date of birth (18+ verification - required by ToS)
 * - Tier selection
 * - 14-day free trial messaging (no credit card required)
 *
 * Flow:
 * 1. User fills form + validates age
 * 2. Supabase Auth creates the user account
 * 3. Service function creates the org + profile (via service role API call)
 * 4. Redirect to dashboard (they're on trial)
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

async function handleGoogleSignup() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

const TIERS = [
  {
    id:    'capture_i',
    name:  'Capture I',
    price: '$39/mo admin',
    features: [
      'Unlimited projects',
      'Video capture (1.5 min)',
      'Team Chat (4 groups)',
      'Calendar (up to 10 users)',
      'AI Report Writer (5/week)',
    ],
  },
  {
    id:    'intelligence_ii',
    name:  'Intelligence II',
    price: '$59/mo admin',
    popular: true,
    features: [
      'Everything in Capture I',
      'Before & After comparison',
      'Video capture (6 min)',
      'Team Chat (15 groups)',
      'Calendar (up to 25 users)',
      'AI Report Writer (75/week)',
    ],
  },
  {
    id:    'command_iii',
    name:  'Command III',
    price: '$79/mo admin',
    features: [
      'Everything in Intelligence II',
      'Video capture (12 min)',
      'Team Chat (50 groups)',
      'Unlimited calendar users',
      'AI Report Writer (1000/week)',
      'Client Portal (desktop)',
    ],
  },
];

/**
 * Validate that the user is at least 18 years old.
 */
function isAtLeast18(dobString) {
  if (!dobString) return false;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return dob <= cutoff;
}

/**
 * Generate a URL-safe slug from org name
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export default function SignupPage({ onLogin }) {
  const [form, setForm] = useState({
    orgName:     '',
    fullName:    '',
    email:       '',
    password:    '',
    confirmPass: '',
    dateOfBirth: '',
    tier:        'capture_i',
  });

  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]  = useState(false);
  const [step, setStep]        = useState(1); // 1 = account info, 2 = tier selection

  function updateField(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function validateStep1() {
    const errs = {};

    if (!form.orgName.trim()) errs.orgName = 'Company name is required';
    if (form.orgName.trim().length < 2) errs.orgName = 'Company name must be at least 2 characters';

    if (!form.fullName.trim()) errs.fullName = 'Your name is required';

    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address';

    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';

    if (!form.confirmPass) errs.confirmPass = 'Please confirm your password';
    else if (form.password !== form.confirmPass) errs.confirmPass = 'Passwords do not match';

    if (!form.dateOfBirth) {
      errs.dateOfBirth = 'Date of birth is required';
    } else if (!isAtLeast18(form.dateOfBirth)) {
      // LEGAL: Users must be 18+ to use KrakenCam
      errs.dateOfBirth = 'You must be at least 18 years old to create an account';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleStep1Submit(e) {
    e.preventDefault();
    if (validateStep1()) setStep(2);
  }

  async function handleSignup(e) {
    e.preventDefault();
    setApiError('');
    setLoading(true);

    try {
      // Step 1: Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      const userId = authData.user.id;

      // Step 2: Create org + profile via Edge Function (service role, bypasses RLS)
      // Use the anon key as the bearer token since the Edge Function uses service role internally
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const accessToken = authData.session?.access_token || anonKey;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-org`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            orgName:     form.orgName.trim(),
            userId:      userId,
            fullName:    form.fullName.trim(),
            email:       form.email,
            dateOfBirth: form.dateOfBirth,
            tier:        form.tier,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to create organization');
      }

      // Success! AuthProvider will detect the new session and redirect.
      // No navigate needed - AppRouter handles it.
    } catch (err) {
      console.error('[SignupPage] Signup error:', err);
      if (err.message?.includes('already registered')) {
        setApiError('An account with this email already exists. Try signing in.');
      } else if (err.message?.includes('duplicate key') && err.message?.includes('slug')) {
        setApiError('An organization with that name already exists. Try a different name.');
      } else {
        setApiError('Something went wrong. Please try again or contact support@krakencam.com');
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === 1) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--wide">
          <div className="auth-logo">
            <img src="/krakencam-logo.svg" alt="KrakenCam" />
          </div>

          <h1>Start Your Free Trial</h1>
          <p className="auth-subtitle trial-badge">
            ✓ 14-day free trial &nbsp;·&nbsp; ✓ No credit card required
          </p>

          <button type="button" className="btn-google btn-full" onClick={handleGoogleSignup}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <div className="auth-divider"><span>or sign up with email</span></div>

          <form onSubmit={handleStep1Submit} noValidate>
            <div className="form-group">
              <label htmlFor="orgName">Company Name</label>
              <input
                id="orgName"
                type="text"
                value={form.orgName}
                onChange={updateField('orgName')}
                placeholder="Acme Restoration Inc."
                autoFocus
              />
              {errors.orgName && <span className="field-error">{errors.orgName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Your Full Name</label>
              <input
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={updateField('fullName')}
                placeholder="Jane Smith"
              />
              {errors.fullName && <span className="field-error">{errors.fullName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Work Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={updateField('email')}
                placeholder="jane@acmerestore.com"
                autoComplete="email"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={updateField('password')}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPass">Confirm Password</label>
              <input
                id="confirmPass"
                type="password"
                value={form.confirmPass}
                onChange={updateField('confirmPass')}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
              {errors.confirmPass && <span className="field-error">{errors.confirmPass}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="dateOfBirth">
                Date of Birth <span className="label-note">(you must be 18 or older)</span>
              </label>
              <input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={updateField('dateOfBirth')}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                  .toISOString().split('T')[0]}
              />
              {errors.dateOfBirth && (
                <span className="field-error">{errors.dateOfBirth}</span>
              )}
            </div>

            <button type="submit" className="btn-primary btn-full">
              Continue →
            </button>
          </form>

          <div className="auth-links">
            Already have an account? <button className="btn-link" onClick={onLogin}>Sign in</button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Tier selection
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--tiers">
        <h1>Choose Your Plan</h1>
        <p className="auth-subtitle trial-badge">
          ✓ All plans start with a 14-day free trial &nbsp;·&nbsp; ✓ No credit card needed today
        </p>

        <form onSubmit={handleSignup} noValidate>
          <div className="tier-grid">
            {TIERS.map(tier => (
              <label
                key={tier.id}
                className={`tier-card ${form.tier === tier.id ? 'tier-card--selected' : ''} ${tier.popular ? 'tier-card--popular' : ''}`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={tier.id}
                  checked={form.tier === tier.id}
                  onChange={updateField('tier')}
                />
                {tier.popular && <span className="tier-popular-badge">Most Popular</span>}
                <h3>{tier.name}</h3>
                <p className="tier-price">{tier.price}</p>
                <ul className="tier-features">
                  {tier.features.map(f => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
              </label>
            ))}
          </div>

          <p className="tier-note">
            All plans include $29/mo per additional user. You can change plans anytime.
          </p>

          {apiError && (
            <div className="auth-error" role="alert">
              {apiError}
            </div>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              ← Back
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating your account...' : 'Start Free Trial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
