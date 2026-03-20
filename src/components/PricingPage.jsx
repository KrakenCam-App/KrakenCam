/**
 * PricingPage.jsx
 *
 * Public-facing pricing page with monthly/annual toggle.
 * Shows all 3 tiers with features and a trial CTA.
 * Can also be shown to logged-in users upgrading their plan.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const PLANS = {
  capture_i: {
    name:         'Capture I',
    monthlyAdmin: 39,
    annualAdmin:  33,
    seatMonthly:  29,
    seatAnnual:   26,
    color:        '#2563eb',
    features: [
      { text: 'Unlimited projects',            included: true },
      { text: 'Video capture (1.5 min)',        included: true },
      { text: 'Team Chat (4 groups)',           included: true },
      { text: 'Calendar (up to 10 users)',      included: true },
      { text: 'AI Report Writer (5/week)',      included: true },
      { text: 'Before & After comparison',     included: false },
      { text: 'Client Portal',                  included: false },
    ],
  },
  intelligence_ii: {
    name:         'Intelligence II',
    monthlyAdmin: 59,
    annualAdmin:  50,
    seatMonthly:  29,
    seatAnnual:   26,
    color:        '#7c3aed',
    popular:      true,
    features: [
      { text: 'Unlimited projects',            included: true },
      { text: 'Video capture (6 min)',         included: true },
      { text: 'Team Chat (15 groups)',         included: true },
      { text: 'Calendar (up to 25 users)',     included: true },
      { text: 'AI Report Writer (75/week)',    included: true },
      { text: 'Before & After comparison',    included: true },
      { text: 'Client Portal',                 included: false },
    ],
  },
  command_iii: {
    name:         'Command III',
    monthlyAdmin: 79,
    annualAdmin:  67,
    seatMonthly:  29,
    seatAnnual:   26,
    color:        '#0f172a',
    features: [
      { text: 'Unlimited projects',            included: true },
      { text: 'Video capture (12 min)',        included: true },
      { text: 'Team Chat (50 groups)',         included: true },
      { text: 'Calendar (unlimited users)',    included: true },
      { text: 'AI Report Writer (1000/week)', included: true },
      { text: 'Before & After comparison',    included: true },
      { text: 'Client Portal (desktop)',       included: true },
    ],
  },
};

export default function PricingPage() {
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();

  function annualSavings(plan) {
    const monthlyCost = plan.monthlyAdmin * 12;
    const annualCost  = plan.annualAdmin * 12;
    return Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
  }

  function handleSelectPlan(tierId) {
    if (!session) {
      // Not logged in → go to signup with tier pre-selected
      navigate(`/signup?tier=${tierId}&billing=${billing}`);
    } else if (isAdmin) {
      // Logged in admin → go to billing to upgrade
      navigate(`/billing?upgrade=${tierId}&billing=${billing}`);
    } else {
      // Regular user → only admin can manage billing
      navigate('/billing');
    }
  }

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Simple, Transparent Pricing</h1>
        <p>Start your 14-day free trial. No credit card required.</p>

        {/* Billing toggle */}
        <div className="billing-toggle">
          <button
            className={billing === 'monthly' ? 'active' : ''}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            className={billing === 'annual' ? 'active' : ''}
            onClick={() => setBilling('annual')}
          >
            Annual
            <span className="save-badge">Save up to 17%</span>
          </button>
        </div>
      </div>

      <div className="pricing-grid">
        {Object.entries(PLANS).map(([tierId, plan]) => {
          const adminPrice = billing === 'annual' ? plan.annualAdmin : plan.monthlyAdmin;
          const seatPrice  = billing === 'annual' ? plan.seatAnnual : plan.seatMonthly;

          return (
            <div
              key={tierId}
              className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''}`}
              style={{ '--plan-color': plan.color }}
            >
              {plan.popular && (
                <div className="popular-badge">Most Popular</div>
              )}

              <h2>{plan.name}</h2>

              <div className="pricing-price">
                <span className="price-amount">${adminPrice}</span>
                <span className="price-period">/mo admin</span>
              </div>
              <div className="pricing-seat">
                +${seatPrice}/mo per additional user
              </div>

              {billing === 'annual' && (
                <div className="annual-savings">
                  Save {annualSavings(plan)}% vs monthly (billed annually)
                </div>
              )}

              <ul className="feature-list">
                {plan.features.map(f => (
                  <li key={f.text} className={f.included ? 'included' : 'excluded'}>
                    <span className="feature-icon">{f.included ? '✓' : '✗'}</span>
                    {f.text}
                  </li>
                ))}
              </ul>

              <button
                className={`btn-cta ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectPlan(tierId)}
              >
                Start Free Trial
              </button>
            </div>
          );
        })}
      </div>

      <div className="pricing-footer">
        <p>
          All plans include: Supabase-powered secure storage, photo/video capture,
          GPS tagging, and unlimited picture uploads.
        </p>
        <p>
          Need a custom plan for a large team?{' '}
          <a href="mailto:info@krakencam.com">Contact us</a> for enterprise pricing.
        </p>
      </div>

      <div className="trial-cta-box">
        <h2>Not sure which plan? Start with any — you can change later.</h2>
        <p>Your 14-day trial gives you full access to all features. No credit card needed.</p>
        {!session && (
          <Link to="/signup" className="btn-primary btn-large">
            Start Free Trial
          </Link>
        )}
      </div>
    </div>
  );
}
