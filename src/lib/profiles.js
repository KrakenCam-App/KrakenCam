/**
 * src/lib/profiles.js
 *
 * CRUD helpers for user profiles.
 * RLS policies ensure users only see profiles in their own org.
 * Admin-only operations (invite, deactivate) are also handled here.
 */

import { supabase } from './supabase';

/**
 * Get all active profiles in the current user's org.
 * Useful for team member lists.
 */
export async function getOrgProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, role, full_name, email, created_at, is_active')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get a single profile by user_id.
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the current logged-in user's own profile.
 */
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return getProfile(user.id);
}

/**
 * Update current user's own profile (name only - role is admin-controlled).
 */
export async function updateMyProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const safeUpdates = {
    full_name: updates.full_name,
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Admin: Invite a new user to the org.
 *
 * NOTE: This creates the Supabase auth user via admin invite email,
 * then creates the profile. In production, this should be an edge function
 * so you can use the service role key. Here we document the pattern.
 *
 * The actual auth invite must use the service role (Supabase Admin API).
 * Call POST /api/invite-user instead of calling this directly from client.
 */
export async function inviteUserToOrg({ email, fullName, role = 'user', orgId, dateOfBirth }) {
  // This function is a placeholder. The actual invite flow requires:
  // 1. Call supabase.auth.admin.inviteUserByEmail({ email }) using service role
  // 2. Create the profile row with the new user's ID
  // Both steps must happen server-side.
  throw new Error(
    'inviteUserToOrg must be called via the server-side /api/invite-user endpoint'
  );
}

/**
 * Admin: Activate or deactivate a user in the org.
 * The RLS "profiles_update_admin" policy enforces org membership.
 */
export async function setUserActive(profileId, isActive) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Admin: Change a user's role within the org.
 */
export async function setUserRole(profileId, role) {
  if (!['admin', 'user'].includes(role)) {
    throw new Error('Invalid role. Must be "admin" or "user"');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Admin: Remove a user from the org.
 * This deletes the profile row (Supabase auth user remains but loses org access).
 */
export async function removeUserFromOrg(profileId) {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId);

  if (error) throw error;
}
