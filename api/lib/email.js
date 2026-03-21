/**
 * email.js — Resend email sending utility
 * Used by all API routes that send transactional emails.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL    = 'KrakenCam <noreply@krakencam.com>'   // transactional (welcome, reset, invoices)
const SUPPORT_EMAIL = 'KrakenCam Support <support@krakencam.com>' // support replies
const INFO_EMAIL    = 'KrakenCam <info@krakencam.com>'            // sales & general inquiries
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Load an email template from the DB, fall back to hardcoded if not found.
 */
async function loadTemplate(templateId, fallback) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/email_templates?id=eq.${templateId}&select=subject,body_html`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    })
    const rows = await res.json()
    if (rows?.[0]) return rows[0]
  } catch(e) {}
  return fallback
}

/**
 * Replace template variables: {{ first_name }}, {{ org_name }}, etc.
 */
function renderTemplate(html, vars) {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] || '')
}

/**
 * Send an email via Resend.
 */
async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, reply_to: SUPPORT_EMAIL })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Failed to send email')
  return data
}

// ── Transactional email functions ─────────────────────────────────────────────

export async function sendWelcomeEmail({ to, firstName, orgName }) {
  const tmpl = await loadTemplate('welcome', {
    subject: 'Welcome to KrakenCam 🦑',
    body_html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="color:#0055cc">Welcome to KrakenCam!</h2><p>Hi {{first_name}},</p><p>Your account for <strong>{{org_name}}</strong> is ready. Start capturing incredible footage and managing your team with ease.</p><a href="https://app.krakencam.com" style="display:inline-block;background:#0055cc;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Go to KrakenCam →</a><p style="color:#888;font-size:12px">You are on a 14-day free trial. No credit card required yet.</p></div>`
  })
  const html = renderTemplate(tmpl.body_html, { first_name: firstName, org_name: orgName })
  return sendEmail({ to, subject: tmpl.subject, html })
}

export async function sendTrialEndingEmail({ to, firstName, daysLeft, trialEndsAt }) {
  const tmpl = await loadTemplate('trial_ending', {
    subject: `Your KrakenCam trial ends in ${daysLeft} days`,
    body_html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="color:#d97706">Your trial is almost over</h2><p>Hi {{first_name}},</p><p>Your free trial ends in <strong>{{days_left}} days</strong>. Upgrade now to keep all your data and continue with uninterrupted access.</p><a href="https://app.krakencam.com/billing" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Upgrade Now →</a></div>`
  })
  const html = renderTemplate(tmpl.body_html, { first_name: firstName, days_left: daysLeft })
  const subject = tmpl.subject.replace(/\d+ days/, `${daysLeft} days`)
  return sendEmail({ to, subject, html })
}

export async function sendPaymentFailedEmail({ to, orgName }) {
  const tmpl = await loadTemplate('payment_failed', {
    subject: 'Action required: Payment failed for KrakenCam',
    body_html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="color:#dc2626">Payment Failed</h2><p>Hi {{org_name}} team,</p><p>We were unable to process your payment. Please update your billing information to avoid service interruption.</p><a href="https://app.krakencam.com/billing" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Update Billing →</a><p style="color:#888;font-size:12px">We will retry in 3 days. After 3 failed attempts your account will be suspended.</p></div>`
  })
  const html = renderTemplate(tmpl.body_html, { org_name: orgName })
  return sendEmail({ to, subject: tmpl.subject, html })
}

export async function sendCancellationEmail({ to, firstName }) {
  const tmpl = await loadTemplate('subscription_cancelled', {
    subject: 'Your KrakenCam subscription has been cancelled',
    body_html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="color:#6b7280">Subscription Cancelled</h2><p>Hi {{first_name}},</p><p>Your KrakenCam subscription has been cancelled. You will retain access until the end of your current billing period.</p><p>Your data will be available for <strong>60 days</strong> after cancellation.</p><a href="https://app.krakencam.com/billing" style="display:inline-block;background:#374151;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Reactivate →</a></div>`
  })
  const html = renderTemplate(tmpl.body_html, { first_name: firstName })
  return sendEmail({ to, subject: tmpl.subject, html })
}
