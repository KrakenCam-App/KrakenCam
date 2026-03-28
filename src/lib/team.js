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
 */
export async function removeUser(profileId) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', profileId);
  if (error) throw error;
}

/**
 * Create a new team member profile in Supabase.
 * Used when an admin adds a user before they have a Supabase Auth account.
 *
 * @param {Object} user  - User form data.
 * @param {string} orgId - Organization ID (UUID) from the admin's profile.
 */
export async function createTeamMember(user, orgId) {
  const patch = {
    organization_id:   orgId,
    role:              user.role        || 'user',
    full_name:         `${user.firstName||''} ${user.lastName||''}`.trim(),
    first_name:        user.firstName   || '',
    last_name:         user.lastName    || '',
    email:             user.email       || '',
    phone:             user.phone       || '',
    mobile:            user.mobile      || '',
    title:             user.title       || '',
    department:        user.department  || '',
    employee_id:       user.employeeId  || '',
    start_date:        user.startDate   || '',
    status:            user.status      || 'active',
    is_active:         user.status !== 'inactive',
    notes:             user.notes       || '',
    certifications:    user.certifications    || [],
    permissions:       user.permissions       || {},
    assigned_projects: user.assignedProjects  || [],
    address_street:    user.address     || '',
    address_city:      user.city        || '',
    address_state:     user.state       || '',
    address_zip:       user.zip         || '',
  };

  // Upsert on (organization_id, email) so re-submitting doesn't duplicate
  const { error } = await supabase
    .from('profiles')
    .upsert(patch, { onConflict: 'organization_id,email' });

  if (error) throw error;
}

/**
 * Update a team member's full profile in Supabase.
 * If email changed, also updates Supabase Auth login email via edge function.
 */
export async function updateTeamMember(user, previousEmail) {
  // If email changed, update the Auth login email via edge function
  if (user.email && previousEmail && user.email !== previousEmail && user.user_id) {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const url   = import.meta.env.VITE_SUPABASE_URL
      const anon  = import.meta.env.VITE_SUPABASE_ANON_KEY
      await fetch(`${url}/functions/v1/admin-update-user-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || anon}`,
          'apikey': anon,
        },
        body: JSON.stringify({ user_id: user.user_id, new_email: user.email }),
      })
    } catch (e) {
      console.warn('[KrakenCam] Auth email update failed:', e.message)
    }
  }

  const patch = {
    role:              user.role        || 'user',
    full_name:         `${user.firstName||''} ${user.lastName||''}`.trim(),
    first_name:        user.firstName   || '',
    last_name:         user.lastName    || '',
    email:             user.email       || '',
    phone:             user.phone       || '',
    mobile:            user.mobile      || '',
    title:             user.title       || '',
    department:        user.department  || '',
    employee_id:       user.employeeId  || '',
    start_date:        user.startDate   || '',
    status:            user.status      || 'active',
    is_active:         user.status !== 'inactive',
    notes:             user.notes       || '',
    certifications:    user.certifications    || [],
    permissions:       user.permissions       || {},
    assigned_projects: user.assignedProjects  || [],
  };

  // Look up by email since app users may have local-only IDs before DB sync
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('email', user.email);

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
