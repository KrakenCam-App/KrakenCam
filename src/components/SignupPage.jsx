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
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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

export default function SignupPage() {
  const navigate = useNavigate();

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

      // Step 2: Create org + profile via our own API
      // This is done server-side (with service role) to ensure atomicity
      // and to bypass RLS for the initial org creation.
      const slug = toSlug(form.orgName);

      // Create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: form.orgName.trim(),
          slug: `${slug}-${Date.now()}`, // ensure uniqueness
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create the admin profile
      // NOTE: The RLS "profiles_insert_admin" policy won't apply here because
      // this user isn't an admin yet. The initial profile creation for the org
      // founder should be done via service role in production.
      // For now, we use the client - adjust by calling an edge function if needed.
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          organization_id: org.id,
          user_id:         userId,
          role:            'admin',
          full_name:       form.fullName.trim(),
          email:           form.email,
          date_of_birth:   form.dateOfBirth,
          is_active:       true,
        });

      if (profileError) throw profileError;

      // Success! Navigate to dashboard. They're on 14-day trial.
      navigate('/dashboard?welcome=true');
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
            Already have an account? <Link to="/login">Sign in</Link>
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
