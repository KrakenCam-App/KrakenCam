/**
 * api/send-email.js
 *
 * Handles all email sending: transactional + blast.
 * SECURITY: Requires X-Internal-Secret header.
 */

import {
  sendWelcomeEmail,
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendCancellationEmail,
} from './lib/email.js'

const RESEND_API_KEY       = process.env.RESEND_API_KEY
const SUPABASE_URL         = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FROM_EMAIL           = 'KrakenCam <noreply@krakencam.com>'
const REPLY_TO             = 'support@krakencam.com'
// Free tier: 100/day → keep at 50. Pro tier ($20/mo): raise to 500+.
const MAX_BATCH            = 50

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const internalSecret = process.env.INTERNAL_EMAIL_SECRET || 'krakencam-internal-2024'
  const providedSecret = req.headers['x-internal-secret']
  if (!providedSecret || providedSecret !== internalSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { type } = req.body
  if (!type) return res.status(400).json({ error: 'Missing required field: type' })

  // ── Blast ──────────────────────────────────────────────────────────────────
  if (type === 'blast') {
    const { subject, html, target, dry_run } = req.body
    if (!subject || !html || !target) {
      return res.status(400).json({ error: 'subject, html, and target are required for blast' })
    }

    const headers = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    }

    // Get matching org IDs if filtering by tier/status
    let orgFilter = null
    if (target !== 'all') {
      let orgUrl = `${SUPABASE_URL}/rest/v1/organizations?select=id`
      if (target === 'trialing')    orgUrl += '&subscription_status=eq.trialing'
      else if (target === 'active') orgUrl += '&subscription_status=eq.active'
      else                          orgUrl += `&subscription_tier=eq.${target}&subscription_status=eq.active`
      const orgRes = await fetch(orgUrl, { headers })
      const orgs = await orgRes.json()
      if (!orgs?.length) return res.status(200).json({ success: true, sent: 0, message: 'No matching organizations' })
      orgFilter = orgs.map(o => o.id)
    }

    // Get admin profiles
    let profileUrl = `${SUPABASE_URL}/rest/v1/profiles?select=email,full_name&role=eq.admin&is_active=eq.true`
    if (orgFilter) {
      const ids = orgFilter.map(id => `organization_id=eq.${id}`).join(',')
      profileUrl += `&or=(${ids})`
    }
    const profileRes = await fetch(profileUrl, { headers })
    let profiles = await profileRes.json()
    if (!Array.isArray(profiles)) return res.status(500).json({ error: 'Failed to load profiles' })

    // Dedupe
    const seen = new Set()
    const recipients = profiles.filter(p => {
      if (!p.email || seen.has(p.email)) return false
      seen.add(p.email); return true
    })

    if (dry_run) {
      return res.status(200).json({
        success: true, dry_run: true,
        recipient_count: recipients.length,
        sample: recipients.slice(0, 5).map(p => p.email),
      })
    }

    if (!recipients.length) return res.status(200).json({ success: true, sent: 0, message: 'No recipients found' })

    let sent = 0, failed = 0
    const errors = []
    for (const p of recipients.slice(0, MAX_BATCH)) {
      const personalised = html
        .replace(/\{\{first_name\}\}/gi, p.full_name?.split(' ')[0] || 'there')
        .replace(/\{\{full_name\}\}/gi, p.full_name || '')
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to: p.email, subject, html: personalised }),
        })
        if (r.ok) sent++; else { failed++; errors.push(`${p.email}: ${r.status}`) }
      } catch (e) { failed++; errors.push(`${p.email}: ${e.message}`) }
      await new Promise(r => setTimeout(r, 50))
    }

    // Log to audit
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ event_type: 'email_blast.sent', details: { subject, target, sent, failed, total_recipients: recipients.length } })
      })
    } catch { /* non-fatal */ }

    return res.status(200).json({
      success: true, sent, failed,
      total_recipients: recipients.length,
      capped_at: recipients.length > MAX_BATCH ? MAX_BATCH : null,
      errors: errors.length ? errors : undefined,
    })
  }

  // ── Transactional ──────────────────────────────────────────────────────────
  const { to, firstName, orgName, daysLeft, trialEndsAt } = req.body
  if (!to) return res.status(400).json({ error: 'Missing required field: to' })

  try {
    switch (type) {
      case 'welcome':        await sendWelcomeEmail({ to, firstName, orgName }); break
      case 'trial_ending':   await sendTrialEndingEmail({ to, firstName, daysLeft, trialEndsAt }); break
      case 'payment_failed': await sendPaymentFailedEmail({ to, orgName }); break
      case 'cancellation':   await sendCancellationEmail({ to, firstName }); break
      default: return res.status(400).json({ error: `Unknown email type: ${type}` })
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-email] Failed:', err)
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
