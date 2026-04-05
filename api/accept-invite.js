/**
 * api/accept-invite.js
 *
 * POST { token, fullName, password }
 *
 * Validates invitation token, creates Supabase auth user,
 * links or creates profile, marks invitation accepted.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token, fullName, password } = req.body

  if (!token || !fullName || !password) {
    return res.status(400).json({ error: 'Missing required fields: token, fullName, password' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // --- Validate token ---
  const { data: invitation, error: invError } = await supabaseAdmin
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (invError || !invitation) {
    return res.status(404).json({ error: 'Invalid or expired invitation token' })
  }

  // Check expiry
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This invitation has expired' })
  }

  const email = invitation.email

  // Split fullName into first/last for the profiles table
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0] || ''
  const lastName  = nameParts.slice(1).join(' ') || ''

  // --- Check if auth user already exists ---
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email === email)

  let authUserId

  if (existingUser) {
    authUserId = existingUser.id
  } else {
    // Create Supabase auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm — they clicked the invite link
      user_metadata: { full_name: fullName },
    })

    if (createError || !newUser?.user) {
      console.error('[accept-invite] Failed to create auth user:', createError)
      return res.status(500).json({ error: createError?.message || 'Failed to create user account' })
    }

    authUserId = newUser.user.id
  }

  // --- Link or create profile ---
  // If admin pre-added this user (profile exists with user_id = null), update that row.
  // Otherwise insert a fresh profile. This avoids the unique(org_id, email) conflict.
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('organization_id', invitation.organization_id)
    .is('user_id', null)
    .maybeSingle()

  if (existingProfile) {
    // Update the pre-created profile to link the new auth user
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        user_id:    authUserId,
        full_name:  fullName,
        first_name: firstName,
        last_name:  lastName,
        is_active:  true,
        status:     'active',
      })
      .eq('id', existingProfile.id)

    if (updateError) {
      console.error('[accept-invite] Failed to update existing profile:', updateError)
      return res.status(500).json({ error: 'Failed to update user profile' })
    }
  } else {
    // No pre-created profile — insert one
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id:         authUserId,
        email,
        full_name:       fullName,
        first_name:      firstName,
        last_name:       lastName,
        organization_id: invitation.organization_id,
        role:            invitation.role || 'user',
        is_active:       true,
        status:          'active',
      }, { onConflict: 'user_id' })

    if (profileError) {
      console.error('[accept-invite] Failed to create profile:', profileError)
      return res.status(500).json({ error: 'Failed to create user profile' })
    }
  }

  // --- Mark invitation as accepted ---
  await supabaseAdmin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)

  return res.status(200).json({ success: true })
}
