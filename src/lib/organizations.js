/**
 * src/lib/organizations.js
 *
 * CRUD helpers for organizations.
 * RLS automatically ensures users can only see/modify their own org.
 */

import { supabase } from './supabase';

/**
 * Get the current user's organization.
 * RLS guarantees this only returns their org.
 */
export async function getMyOrganization() {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update org details (admin only, enforced by RLS policy).
 */
export async function updateOrganization(orgId, updates) {
  // Only allow updating safe fields - never let users change stripe IDs or subscription tier
  const safeUpdates = {
    name: updates.name,
    slug: updates.slug,
  };

  const { data, error } = await supabase
    .from('organizations')
    .update(safeUpdates)
    .eq('id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if a slug is available (for org name changes).
 */
export async function isSlugAvailable(slug, excludeOrgId = null) {
  let query = supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug);

  if (excludeOrgId) {
    query = query.neq('id', excludeOrgId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.length === 0;
}

/**
 * Get org stats (admin dashboard use).
 */
export async function getOrgStats(orgId) {
  const [profilesResult, projectsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true),
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active'),
  ]);

  return {
    activeUsers:    profilesResult.count || 0,
    activeProjects: projectsResult.count || 0,
  };
}
