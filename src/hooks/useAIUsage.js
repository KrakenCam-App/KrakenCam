/**
 * useAIUsage.js
 *
 * Hook to check and increment AI generation usage against the weekly quota.
 *
 * Each user has a weekly AI generation limit based on their tier:
 *   Capture I:       5/week
 *   Intelligence II: 75/week
 *   Command III:     1000/week
 *   Enterprise:      Unlimited
 *
 * Usage:
 *   const { remaining, canGenerate, incrementUsage, isLoading } = useAIUsage();
 *
 *   async function handleGenerate() {
 *     if (!canGenerate) { alert('Weekly limit reached!'); return; }
 *     await doAIGeneration();
 *     await incrementUsage();
 *   }
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { useSubscription } from './useSubscription';

/**
 * Get the Monday of the current week (ISO week start)
 */
function getCurrentWeekStart() {
  const now  = new Date();
  const day  = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = (day === 0 ? -6 : 1) - day; // how many days to subtract to get to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function useAIUsage() {
  const { user, orgId } = useAuth();
  const { limits }      = useSubscription();

  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState(null);

  const weekStart = getCurrentWeekStart();
  const weeklyLimit = limits.aiWeeklyLimit;

  const loadUsage = useCallback(async () => {
    if (!user || !orgId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('ai_usage')
      .select('generation_count')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .eq('week_start', weekStart)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = row not found (no usage yet this week)
      console.error('[useAIUsage] Failed to load usage:', error);
      setError(error.message);
    } else {
      setUsageCount(data?.generation_count || 0);
    }

    setIsLoading(false);
  }, [user, orgId, weekStart]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  /**
   * Increment usage count by 1 (or a custom amount).
   * Uses an UPSERT to handle the case where no row exists yet this week.
   */
  const incrementUsage = useCallback(async (amount = 1) => {
    if (!user || !orgId) return;

    // Optimistic update
    setUsageCount(prev => prev + amount);

    const { error } = await supabase
      .from('ai_usage')
      .upsert(
        {
          user_id:          user.id,
          organization_id:  orgId,
          week_start:       weekStart,
          generation_count: usageCount + amount,
        },
        { onConflict: 'organization_id,user_id,week_start' }
      );

    if (error) {
      console.error('[useAIUsage] Failed to increment usage:', error);
      // Roll back optimistic update
      setUsageCount(prev => prev - amount);
      throw error;
    }
  }, [user, orgId, weekStart, usageCount]);

  const remaining    = weeklyLimit === Infinity ? Infinity : Math.max(0, weeklyLimit - usageCount);
  const canGenerate  = weeklyLimit === Infinity || usageCount < weeklyLimit;

  return {
    usageCount,
    remaining,
    weeklyLimit,
    canGenerate,
    isLoading,
    error,
    incrementUsage,
    refresh: loadUsage,
  };
}
