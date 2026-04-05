/**
 * api/invite-user.js
 *
 * POST { email, role }
 * Headers: Authorization: Bearer <user-jwt>
 *
 * Creates an invitation and sends an email via Resend.
 * Caller must be admin or super_admin.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.APP_URL || 'https://app.krakencam.com'
const FROM_EMAIL = 'KrakenCam <noreply@krakencam.com>'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Verify caller JWT ---
  const authHeader = req.headers.authorization || ''
  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  // Use service role client to bypass RLS, but verify the JWT first
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify the JWT and get the user
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt)
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Check caller's profile role
  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, organization_id, full_name')
    .eq('user_id', user.id)
    .single()

  if (profileError || !callerProfile) {
    return res.status(403).json({ error: 'Profile not found' })
  }

  if (!['admin', 'super_admin'].includes(callerProfile.role)) {
    return res.status(403).json({ error: 'Only admins can invite users' })
  }

  // Get organization name
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('name')
    .eq('id', callerProfile.organization_id)
    .single()

  const orgName = org?.name || 'your organization'

  // --- Parse body ---
  const { email, role, resend } = req.body
  if (!email || !role) {
    return res.status(400).json({ error: 'Missing required fields: email, role' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const allowedRoles = ['user', 'admin', 'manager']
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` })
  }

  if (resend) {
    // Resend: delete any existing pending invite first so a fresh one is created
    await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('email', normalizedEmail)
      .eq('organization_id', callerProfile.organization_id)
      .is('accepted_at', null)
  } else {
    // Check for existing pending invite — block duplicates on first send
    const { data: existing } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('organization_id', callerProfile.organization_id)
      .is('accepted_at', null)
      .maybeSingle()

    if (existing) {
      return res.status(409).json({ error: 'A pending invitation already exists for this email.' })
    }
  }

  // --- Insert invitation ---
  const { data: invitation, error: invError } = await supabaseAdmin
    .from('invitations')
    .insert({
      email: normalizedEmail,
      role,
      organization_id: callerProfile.organization_id,
      invited_by: user.id,
    })
    .select()
    .single()

  if (invError || !invitation) {
    console.error('[invite-user] Failed to create invitation:', invError)
    return res.status(500).json({ error: 'Failed to create invitation' })
  }

  const token = invitation.token
  const inviteLink = `${APP_URL}/accept-invite?token=${token}`
  const adminName = callerProfile.full_name || 'A team admin'

  // --- Send email via Resend ---
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: normalizedEmail,
        subject: `You've been invited to join KrakenCam`,
        html: `
          <div style="font-family:'Inter',sans-serif;max-width:520px;margin:auto;color:#111;background:#fff;padding:32px;border-radius:12px">
            <div style="text-align:center;margin-bottom:24px">
              <img src="${APP_URL}/krakencam-icon.png" alt="KrakenCam" style="width:56px;height:56px;object-fit:contain" />
            </div>
            <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 8px">You're invited to KrakenCam!</h2>
            <p style="color:#444;line-height:1.6"><strong>${adminName}</strong> has invited you to join <strong>${orgName}</strong> on KrakenCam — the jobsite documentation platform built for construction pros.</p>
            <p style="color:#444;line-height:1.6">Click the button below to accept your invitation and create your account.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
                Accept Invitation →
              </a>
            </div>
            <p style="color:#888;font-size:12px;text-align:center">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
            <p style="color:#aaa;font-size:11px;text-align:center">KrakenCam · <a href="mailto:info@krakencam.com" style="color:#aaa">info@krakencam.com</a></p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const emailErr = await emailRes.json()
      console.error('[invite-user] Resend error:', emailErr)
      // Don't fail the whole request — invitation is created, just email failed
    }
  } catch (emailErr) {
    console.error('[invite-user] Failed to send email:', emailErr)
  }

  return res.status(200).json({ success: true, token })
}
