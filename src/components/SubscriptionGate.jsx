/**
 * SubscriptionGate.jsx
 *
 * Higher-Order Component (HOC) and component that gates features based on
 * the current subscription tier.
 *
 * Usage (component form):
 *   <SubscriptionGate feature="clientPortal">
 *     <ClientPortal />
 *   </SubscriptionGate>
 *
 * Usage (HOC form):
 *   export default withSubscriptionGate(ClientPortal, 'clientPortal');
 *
 * Available features (from useSubscription):
 *   - clientPortal    → command_iii only
 *   - beforeAfter     → intelligence_ii+
 *   - aiReports       → all tiers (limited by count)
 *   - extendedVideo   → intelligence_ii+ (6+ min)
 *   - unlimitedCalendar → command_iii only
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from './AuthProvider';

const FEATURE_TIER_NAMES = {
  clientPortal:       'Command III',
  beforeAfter:        'Intelligence II',
  aiReports:          'Capture I',
  extendedVideo:      'Intelligence II',
  unlimitedCalendar:  'Command III',
};

export function SubscriptionGate({ feature, children, fallback }) {
  const { hasFeature, tier } = useSubscription();
  const { isAdmin } = useAuth();

  if (hasFeature(feature)) {
    return children;
  }

  // If a custom fallback is provided, use it
  if (fallback) {
    return fallback;
  }

  // Default locked state UI
  const requiredTier = FEATURE_TIER_NAMES[feature] || 'a higher plan';

  return (
    <div className="feature-locked">
      <div className="feature-locked-icon">🔒</div>
      <h3>Upgrade Required</h3>
      <p>
        This feature requires the <strong>{requiredTier}</strong> plan or higher.
        You're currently on <strong>{tier}</strong>.
      </p>
      {isAdmin ? (
        <Link to="/billing" className="btn-primary">
          Upgrade Now
        </Link>
      ) : (
        <p className="feature-locked-note">
          Contact your organization admin to upgrade.
        </p>
      )}
    </div>
  );
}

/**
 * HOC version for wrapping entire page components
 */
export function withSubscriptionGate(WrappedComponent, feature) {
  return function GatedComponent(props) {
    return (
      <SubscriptionGate feature={feature}>
        <WrappedComponent {...props} />
      </SubscriptionGate>
    );
  };
}

export default SubscriptionGate;
