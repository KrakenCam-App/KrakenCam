/**
 * useSubscription.js
 *
 * Returns the current subscription tier, plan limits, and feature availability.
 *
 * Usage:
 *   const { tier, limits, hasFeature, isActive } = useSubscription();
 *
 *   if (!hasFeature('clientPortal')) {
 *     return <UpgradeBanner />;
 *   }
 */

import { useAuth } from '../components/AuthProvider';

/**
 * Tier definitions - single source of truth for limits.
 * These must match the BUILD_PLAN.md spec.
 */
const TIER_LIMITS = {
  trial: {
    // Trial gets Intelligence II limits (full access during trial)
    videoMinutes:     6,
    chatGroups:       15,
    calendarUsers:    25,
    aiWeeklyLimit:    75,
    beforeAfter:      true,
    clientPortal:     false,
    maxProjects:      Infinity,
    maxSeats:         Infinity,
  },
  capture_i: {
    videoMinutes:     1.5,
    chatGroups:       4,
    calendarUsers:    10,
    aiWeeklyLimit:    5,
    beforeAfter:      false,
    clientPortal:     false,
    maxProjects:      Infinity,
    maxSeats:         Infinity,
  },
  intelligence_ii: {
    videoMinutes:     6,
    chatGroups:       15,
    calendarUsers:    25,
    aiWeeklyLimit:    75,
    beforeAfter:      true,
    clientPortal:     false,
    maxProjects:      Infinity,
    maxSeats:         Infinity,
  },
  command_iii: {
    videoMinutes:     12,
    chatGroups:       50,
    calendarUsers:    Infinity,
    aiWeeklyLimit:    1000,
    beforeAfter:      true,
    clientPortal:     true,
    maxProjects:      Infinity,
    maxSeats:         Infinity,
  },
  enterprise: {
    // Enterprise gets everything unlimited
    videoMinutes:     Infinity,
    chatGroups:       Infinity,
    calendarUsers:    Infinity,
    aiWeeklyLimit:    Infinity,
    beforeAfter:      true,
    clientPortal:     true,
    maxProjects:      Infinity,
    maxSeats:         Infinity,
  },
};

// Default to most restrictive limits when no subscription is loaded
const DEFAULT_LIMITS = TIER_LIMITS.capture_i;

/**
 * Map feature names to the limit key/value that controls them
 */
const FEATURE_CHECKS = {
  clientPortal:      limits => limits.clientPortal === true,
  beforeAfter:       limits => limits.beforeAfter === true,
  aiReports:         limits => limits.aiWeeklyLimit > 0,
  extendedVideo:     limits => limits.videoMinutes > 1.5,
  unlimitedCalendar: limits => limits.calendarUsers === Infinity,
};

export function useSubscription() {
  const { subscription } = useAuth();

  // Determine effective tier
  const rawTier = subscription?.plan_tier || 'capture_i';
  const status  = subscription?.status || 'trialing';

  // Determine effective tier to use for limits
  // During trial, use trial limits (generous - intelligence_ii level)
  const effectiveTier = (() => {
    if (status === 'trialing') return 'trial';
    if (['cancelled', 'expired'].includes(status)) return 'capture_i'; // degraded
    return rawTier;
  })();

  const limits = TIER_LIMITS[effectiveTier] || DEFAULT_LIMITS;

  /**
   * Check if a named feature is available on the current plan
   */
  function hasFeature(featureName) {
    if (['cancelled', 'expired'].includes(status)) return false;
    const check = FEATURE_CHECKS[featureName];
    if (!check) {
      console.warn(`[useSubscription] Unknown feature: "${featureName}"`);
      return false;
    }
    return check(limits);
  }

  /**
   * Check if the subscription is in a usable state
   */
  const isActive = ['trialing', 'active'].includes(status);

  /**
   * Days remaining in trial (null if not trialing)
   */
  let trialDaysLeft = null;
  if (status === 'trialing' && subscription?.current_period_end) {
    const msLeft = new Date(subscription.current_period_end) - new Date();
    trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }

  return {
    tier:          effectiveTier,
    rawTier,
    status,
    limits,
    hasFeature,
    isActive,
    trialDaysLeft,
    seatCount:     subscription?.seat_count || 1,
    billingPeriod: subscription?.billing_period || 'monthly',
  };
}
