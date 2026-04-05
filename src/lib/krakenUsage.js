/**
 * src/lib/krakenUsage.js
 *
 * Centralized Kraken AI usage utilities.
 * All AI features must go through these helpers to stay consistent.
 *
 * Source of truth for the UI: org_settings.settings.aiGenerationsUsed
 * (stored in org_settings table, shared org-wide via settingsSync)
 *
 * Audit log: ai_usage_events table (fire-and-forget, org-scoped RLS)
 *
 * Weekly reset: Saturday 23:59 PM Central Time
 * Tier limits:  base=10, pro=75, command=1000
 */

import { supabase } from './supabase.js';
import { PLAN_AI_LIMITS, getWeekWindowStart } from '../utils/constants.js';

// ── Centralized feature/action cost registry ──────────────────────────────────
// Keep in sync with ai_feature_costs DB table (which is the authoritative seed).
// UI components should import costs from here, not hardcode their own values.
export const KRAKEN_COSTS = {
  project_overview_summary:              1,
  report_editor_ai_write:                1,
  report_editor_one_click_findings:      2,
  report_editor_one_click_progress:      2,
  report_editor_one_click_completion:    4,
  report_editor_one_click_custom:        6,
  assistant_freeform:                    2,
  assistant_one_click:                   2,
};

// Convenience: get cost for report 1-click by type id
export function getOneClickCost(typeId) {
  return KRAKEN_COSTS[`report_editor_one_click_${typeId}`] ?? 2;
}

// ── Permission check ──────────────────────────────────────────────────────────
/**
 * Returns { allowed: true } or { allowed: false }
 * Checks role-level AI permission set by admin via Account > Permissions.
 * Admins are always allowed.
 */
export function checkAiPermission(settings) {
  const role = settings?.userRole || 'admin';
  if (role === 'admin') return { allowed: true };
  if (role === 'manager') {
    return settings?.allowManagersAi !== false
      ? { allowed: true }
      : { allowed: false };
  }
  // 'user' or any other role
  return settings?.allowUsersAi !== false
    ? { allowed: true }
    : { allowed: false };
}

// ── Balance helpers ───────────────────────────────────────────────────────────
/**
 * Get the current AI Kraken balance for the org.
 * Returns { limit, used, remaining, pct, canAfford(cost) }
 */
export function getAiBalance(settings) {
  const plan    = settings?.plan || 'base';
  const limit   = PLAN_AI_LIMITS[plan] || 0;
  const wStart  = settings?.aiGenerationsWindowStart
    ? new Date(settings.aiGenerationsWindowStart) : null;
  const curWin  = getWeekWindowStart();
  const valid   = wStart && wStart >= curWin;
  const used    = valid ? (settings?.aiGenerationsUsed || 0) : 0;
  const remaining = Math.max(0, limit - used);
  const pct     = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return {
    limit,
    used,
    remaining,
    pct,
    canAfford: (cost) => remaining >= cost,
  };
}

// ── Optimistic deduction ──────────────────────────────────────────────────────
/**
 * Deduct Krakens from the org pool optimistically via settings state.
 * This updates org_settings.settings.aiGenerationsUsed (org-wide).
 * Call ONLY after a successful AI response, not before.
 */
export function deductKrakens(count, onSettingsChange) {
  if (!onSettingsChange || count <= 0) return;
  onSettingsChange(prev => {
    const curWin = getWeekWindowStart();
    const wStart = prev.aiGenerationsWindowStart
      ? new Date(prev.aiGenerationsWindowStart) : null;
    const valid  = wStart && wStart >= curWin;
    const used   = valid ? (prev.aiGenerationsUsed || 0) : 0;
    return {
      ...prev,
      aiGenerationsUsed:        used + count,
      aiGenerationsWindowStart: valid
        ? prev.aiGenerationsWindowStart
        : curWin.toISOString(),
    };
  });
}

// ── Event logging ─────────────────────────────────────────────────────────────
/**
 * Log an AI usage event to the ai_usage_events table. Fire-and-forget.
 * Only logs on success (or explicitly passed status).
 *
 * @param {object} p
 * @param {string} p.orgId
 * @param {string} p.userId
 * @param {string} p.featureKey    - one of KRAKEN_COSTS keys or feature name
 * @param {string} [p.actionKey]
 * @param {number} p.krakensCost
 * @param {string} [p.status]      - 'success' | 'failed' | 'blocked' | 'reversed'
 * @param {string} [p.projectId]   - jobsite/project UUID
 * @param {string} [p.reportId]
 * @param {string} [p.modelName]
 * @param {object} [p.metadata]
 */
export function logAiEvent({ orgId, userId, featureKey, actionKey, krakensCost,
  status = 'success', projectId, reportId, modelName, metadata }) {
  if (!orgId || !featureKey) return;
  supabase
    .from('ai_usage_events')
    .insert([{
      organization_id: orgId,
      user_id:         userId || null,
      jobsite_id:      projectId || null,
      report_id:       reportId  || null,
      feature_key:     featureKey,
      action_key:      actionKey  || null,
      krakens_cost:    krakensCost,
      request_status:  status,
      model_name:      modelName  || 'claude-3-5-haiku-20241022',
      metadata_json:   metadata   || null,
      completed_at:    new Date().toISOString(),
    }])
    .then(() => {})
    .catch(e => console.warn('[krakenUsage] logAiEvent:', e?.message));
}
