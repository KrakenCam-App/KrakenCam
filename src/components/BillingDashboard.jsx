/**
 * BillingDashboard.jsx
 *
 * Shows the org admin:
 * - Current plan name, status, and next billing date
 * - Number of seats and cost breakdown
 * - Upgrade/downgrade options
 * - Button to open Stripe Customer Portal for payment management
 * - Trial countdown if still in trial
 */

import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useSubscription } from '../hooks/useSubscription';

const TIER_NAMES = {
  trial:          'Free Trial',
  capture_i:      'Capture I',
  intelligence_ii: 'Intelligence II',
  command_iii:    'Command III',
  enterprise:     'Enterprise',
};

const STATUS_LABELS = {
  trialing: { label: 'Free Trial',  color: '#2563eb' },
  active:   { label: 'Active',      color: '#16a34a' },
  past_due: { label: 'Past Due',    color: '#dc2626' },
  cancelled: { label: 'Cancelled',  color: '#9ca3af' },
  paused:   { label: 'Paused',      color: '#f59e0b' },
};

export default function BillingDashboard() {
  const { subscription, profile } = useAuth();
  const { tier, limits } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError]     = useState('');

  if (!subscription) {
    return (
      <div className="billing-loading">
        <div className="spinner" />
        <p>Loading billing information...</p>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[subscription.status] || STATUS_LABELS.active;
  const tierName   = TIER_NAMES[subscription.plan_tier] || subscription.plan_tier;

  // Calculate trial days remaining
  let trialDaysLeft = null;
  if (subscription.status === 'trialing' && subscription.current_period_end) {
    const msLeft = new Date(subscription.current_period_end) - new Date();
    trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }

  async function openBillingPortal() {
    setPortalError('');
    setPortalLoading(true);

    try {
      const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
      const token = session?.access_token;

      const res = await fetch('/api/create-portal-session', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');

      window.location.href = data.url;
    } catch (err) {
      setPortalError(err.message);
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="billing-dashboard">
      <h1>Billing & Subscription</h1>

      {/* Current Plan Card */}
      <div className="billing-card">
        <div className="billing-card-header">
          <div>
            <h2>{tierName}</h2>
            <span
              className="status-badge"
              style={{ backgroundColor: statusInfo.color }}
            >
              {statusInfo.label}
            </span>
          </div>
          <div className="billing-period-badge">
            {subscription.billing_period === 'annual' ? 'Annual' : 'Monthly'} billing
          </div>
        </div>

        {/* Trial countdown */}
        {trialDaysLeft !== null && (
          <div className="trial-countdown">
            {trialDaysLeft > 0 ? (
              <>
                <strong>{trialDaysLeft} days</strong> remaining in your free trial.
                Add a payment method to continue after your trial ends.
              </>
            ) : (
              <>
                Your trial has ended. Add a payment method to continue using KrakenCam.
              </>
            )}
          </div>
        )}

        {/* Past due warning */}
        {subscription.status === 'past_due' && (
          <div className="billing-warning">
            ⚠ Your last payment failed. Please update your payment method to avoid
            losing access.
          </div>
        )}

        {/* Seats */}
        <div className="billing-details">
          <div className="billing-detail-row">
            <span>Seats</span>
            <span>{subscription.seat_count} user{subscription.seat_count !== 1 ? 's' : ''}</span>
          </div>
          {subscription.current_period_end && subscription.status !== 'trialing' && (
            <div className="billing-detail-row">
              <span>Next billing date</span>
              <span>{new Date(subscription.current_period_end).toLocaleDateString()}</span>
            </div>
          )}
          <div className="billing-detail-row">
            <span>AI generations this week</span>
            <span>{limits.aiWeeklyLimit === Infinity ? 'Unlimited' : `${limits.aiWeeklyLimit}/week`}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="billing-actions">
          <button
            className="btn-primary"
            onClick={openBillingPortal}
            disabled={portalLoading}
          >
            {portalLoading ? 'Opening...' : 'Manage Billing & Payment'}
          </button>

          {(subscription.status === 'trialing' || subscription.status === 'active') && (
            <a href="/pricing" className="btn-secondary">
              Upgrade Plan
            </a>
          )}

          {subscription.status === 'cancelled' && (
            <button className="btn-primary" onClick={openBillingPortal}>
              Reactivate Subscription
            </button>
          )}
        </div>

        {portalError && (
          <p className="billing-error">Error: {portalError}</p>
        )}
      </div>

      {/* Plan Limits Overview */}
      <div className="billing-card">
        <h3>Your Plan Includes</h3>
        <ul className="limits-list">
          <li>Video capture: up to {limits.videoMinutes} min</li>
          <li>Team Chat: up to {limits.chatGroups} groups</li>
          <li>
            Calendar users:{' '}
            {limits.calendarUsers === Infinity ? 'Unlimited' : `up to ${limits.calendarUsers}`}
          </li>
          <li>
            AI Report Writer:{' '}
            {limits.aiWeeklyLimit === Infinity ? 'Unlimited' : `${limits.aiWeeklyLimit}/week`}
          </li>
          {limits.clientPortal && <li>✓ Client Portal (desktop)</li>}
          {limits.beforeAfter && <li>✓ Before & After comparison</li>}
        </ul>
      </div>

      {/* Data deletion warning for cancelled orgs */}
      {subscription.status === 'cancelled' && (
        <div className="billing-card billing-card--danger">
          <h3>⚠ Account Cancelled</h3>
          <p>
            Your subscription has been cancelled. You can reactivate within 60 days
            to restore full access to your data.
          </p>
          {/* data_delete_at is on the org record - show it if available */}
        </div>
      )}
    </div>
  );
}
