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

export async function sendDeletionWarningEmail({ to, firstName, orgName, deletionDate }) {
  const tmpl = await loadTemplate('account_deletion_warning', {
    subject: '⚠️ Your KrakenCam data will be permanently deleted in 15 days',
    body_html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Inter,-apple-system,sans-serif">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e1e2e,#2d1b69);padding:36px 32px;text-align:center">
    <div style="font-size:42px;margin-bottom:12px">🦑</div>
    <div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:8px">KrakenCam</div>
    <div style="font-size:22px;font-weight:800;color:#fff;line-height:1.3">Your account data is about to be<br/>permanently deleted</div>
  </div>

  <!-- Urgency bar -->
  <div style="background:#dc2626;padding:12px 32px;text-align:center">
    <span style="color:#fff;font-weight:700;font-size:14px;letter-spacing:.04em">⏰ PERMANENT DELETION IN 15 DAYS — {{deletion_date}}</span>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px">
    <p style="margin:0 0 16px;font-size:15px;color:#1a1a2e">Hi {{first_name}},</p>

    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
      Your <strong>{{org_name}}</strong> KrakenCam account was cancelled, and your 60-day data retention period is almost up. 
      <strong style="color:#dc2626">All your jobsite photos, reports, checklists, voice notes, and project data will be permanently and irreversibly deleted on {{deletion_date}}.</strong>
    </p>

    <!-- What gets deleted -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin:0 0 28px">
      <div style="font-weight:700;color:#dc2626;margin-bottom:12px;font-size:14px">🗑 What will be permanently deleted:</div>
      <ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:2">
        <li>All jobsite photos and videos</li>
        <li>All reports, checklists, and inspection records</li>
        <li>Voice notes and field documentation</li>
        <li>Project timelines and client portal data</li>
        <li>Team member records and settings</li>
      </ul>
    </div>

    <!-- Don't lose your data box -->
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:20px 24px;margin:0 0 28px">
      <div style="font-weight:700;color:#92400e;margin-bottom:8px;font-size:14px">📥 Haven't downloaded your data yet?</div>
      <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6">
        You can still recover everything. Sign back in to KrakenCam and go to <strong>Settings → Export My Data</strong> to download a complete backup of all your jobsite data before deletion.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0">
      <a href="https://app.krakencam.com" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:800;font-size:16px;letter-spacing:.02em">
        ✅ Reactivate My Account →
      </a>
      <div style="margin-top:12px;font-size:12px;color:#9ca3af">Takes less than 2 minutes. All your data will be restored instantly.</div>
    </div>

    <!-- Why come back -->
    <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-top:8px">
      <div style="font-weight:700;color:#1a1a2e;margin-bottom:16px;font-size:15px">Why restoration contractors choose KrakenCam:</div>
      <div style="display:grid;gap:12px">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">📸</span>
          <div><strong style="color:#1a1a2e;font-size:14px">GPS-tagged field photos</strong><br/><span style="color:#6b7280;font-size:13px">Every photo stamped with location, room, and timestamp — court-ready documentation</span></div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">📄</span>
          <div><strong style="color:#1a1a2e;font-size:14px">AI-powered report writing</strong><br/><span style="color:#6b7280;font-size:13px">Generate professional insurance and contractor reports in seconds, not hours</span></div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">👥</span>
          <div><strong style="color:#1a1a2e;font-size:14px">Team coordination built in</strong><br/><span style="color:#6b7280;font-size:13px">Real-time updates, chat, task assignment — everyone on the same jobsite page</span></div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span style="font-size:20px;flex-shrink:0">🔒</span>
          <div><strong style="color:#1a1a2e;font-size:14px">Client portal included</strong><br/><span style="color:#6b7280;font-size:13px">Share project updates with clients — password protected, always professional</span></div>
        </div>
      </div>
    </div>

    <!-- Steps to reactivate -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;margin:28px 0 0">
      <div style="font-weight:700;color:#0c4a6e;margin-bottom:12px;font-size:14px">How to reactivate in 3 steps:</div>
      <div style="font-size:14px;color:#0c4a6e;line-height:2">
        <div><strong>1.</strong> Visit <a href="https://app.krakencam.com" style="color:#2563eb;font-weight:700">app.krakencam.com</a> and sign in with your email</div>
        <div><strong>2.</strong> Go to <strong>Account → Billing</strong> and choose your plan</div>
        <div><strong>3.</strong> Your data is restored immediately — pick up right where you left off</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center">
    <p style="margin:0 0 8px;font-size:12px;color:#9ca3af">Questions? Reply to this email or contact us at <a href="mailto:support@krakencam.com" style="color:#6b7280">support@krakencam.com</a></p>
    <p style="margin:0;font-size:11px;color:#d1d5db">© {{year}} KrakenCam Inc. · <a href="https://www.krakencam.com/privacy-policy" style="color:#d1d5db">Privacy</a> · <a href="https://www.krakencam.com/terms-of-use" style="color:#d1d5db">Terms</a></p>
  </div>
</div>
</body>
</html>`
  })
  const html = renderTemplate(tmpl.body_html, {
    first_name:    firstName,
    org_name:      orgName,
    deletion_date: deletionDate,
    year:          new Date().getFullYear().toString(),
  })
  return sendEmail({ to, subject: tmpl.subject, html })
}
