/**
 * src/lib/team.js
 *
 * Supabase helpers for team management: reading profiles and managing invitations.
 * All queries are automatically org-scoped via Row Level Security (RLS).
 */

import { supabase } from './supabase';

/**
 * Fetch all profiles (team members) for the current user's org.
 *
 * @returns {Array} Array of profile rows.
 */
export async function getTeamMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create an invitation row for a new team member.
 * The invitation token is generated server-side via DB default.
 *
 * @param {string} email - Email address to invite.
 * @param {string} role  - Role to assign: 'admin' or 'user'.
 * @returns {Object} The newly created invitation row.
 */
export async function inviteUser(email, role = 'user') {
  const { data: row, error } = await supabase
    .from('invitations')
    .insert([{ email: email.toLowerCase().trim(), role }])
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Fetch all pending (not yet accepted) invitations for the current org.
 *
 * @returns {Array} Array of invitation rows where accepted_at is null.
 */
export async function getInvitations() {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Soft-remove a user by setting their profile's is_active flag to false.
 * This revokes access without destroying their data history.
 *
 * @param {string} profileId - profiles.id (UUID)
 */
export async function removeUser(profileId) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', profileId);

  if (error) throw error;
}

/**
 * Cancel / revoke a pending invitation by deleting it.
 *
 * @param {string} invitationId - invitations.id (UUID)
 */
export async function revokeInvitation(invitationId) {
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId);

  if (error) throw error;
}
