/**
 * AdminSettings.jsx
 * Full admin settings page with tabs: General, Email Templates,
 * Webhook Config, Security, and Danger Zone.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getAllOrganizations } from '../../lib/admin'

// ── Style constants ──────────────────────────────────────────────────────────

const S = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    borderBottom: '1px solid rgba(30,60,120,0.3)',
    paddingBottom: 0,
    flexWrap: 'wrap',
  },
  tab: (active) => ({
    padding: '9px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? '#00d4ff' : '#888',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #00d4ff' : '2px solid transparent',
    marginBottom: -1,
    transition: 'all 0.15s',
    userSelect: 'none',
    letterSpacing: 0.2,
  }),
  card: {
    background: 'rgba(10,20,40,0.85)',
    border: '1px solid rgba(30,60,120,0.3)',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 18,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 700,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 13,
    color: '#aaa',
    minWidth: 160,
    flexShrink: 0,
  },
  value: {
    fontSize: 13,
    color: '#e8e8e8',
  },
  input: {
    background: '#0d1017',
    border: '1px solid #1e2638',
    borderRadius: 8,
    color: '#e8e8e8',
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    width: 280,
  },
  readOnly: {
    background: 'rgba(5,10,20,0.6)',
    border: '1px solid #1a2030',
    borderRadius: 8,
    color: '#888',
    padding: '9px 12px',
    fontSize: 13,
    width: 280,
  },
  badge: (color) => ({
    display: 'inline-block',
    background: color === 'green'
      ? 'rgba(0,200,100,0.12)'
      : color === 'blue'
      ? 'rgba(0,212,255,0.12)'
      : color === 'yellow'
      ? 'rgba(255,200,0,0.12)'
      : 'rgba(100,100,100,0.15)',
    color: color === 'green'
      ? '#4ec9b0'
      : color === 'blue'
      ? '#00d4ff'
      : color === 'yellow'
      ? '#ffc700'
      : '#888',
    border: `1px solid ${
      color === 'green'
        ? 'rgba(78,201,176,0.3)'
        : color === 'blue'
        ? 'rgba(0,212,255,0.3)'
        : color === 'yellow'
        ? 'rgba(255,199,0,0.3)'
        : 'rgba(100,100,100,0.2)'
    }`,
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  }),
  btn: {
    background: 'rgba(0,212,255,0.1)',
    border: '1px solid rgba(0,212,255,0.25)',
    borderRadius: 7,
    color: '#00d4ff',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 12,
    transition: 'all 0.15s',
    letterSpacing: 0.3,
  },
  btnDanger: {
    background: 'rgba(255,50,50,0.08)',
    border: '1px solid rgba(255,80,80,0.3)',
    borderRadius: 7,
    color: '#ff6b6b',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 12,
    transition: 'all 0.15s',
    letterSpacing: 0.3,
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #1e2638',
    borderRadius: 7,
    color: '#888',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 12,
    transition: 'all 0.15s',
  },
  select: {
    background: '#0d1017',
    border: '1px solid #1e2638',
    borderRadius: 8,
    color: '#e8e8e8',
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
    minWidth: 180,
  },
  code: {
    background: 'rgba(5,10,25,0.8)',
    color: '#00d4ff',
    padding: '2px 8px',
    borderRadius: 5,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  divider: {
    borderColor: 'rgba(30,60,120,0.2)',
    margin: '16px 0',
  },
  templateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid rgba(30,60,120,0.15)',
    flexWrap: 'wrap',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  modalBox: {
    background: 'rgba(10,20,40,0.98)',
    border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: 14,
    padding: '28px 32px',
    minWidth: 520,
    maxWidth: 680,
    maxHeight: '80vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  statusMsg: (ok) => ({
    fontSize: 12,
    color: ok ? '#4ec9b0' : '#ff6b6b',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }),
}

// ── Email template definitions ───────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    trigger: 'Sent on signup',
    subject: 'Welcome to KrakenCam 🦑',
    status: 'active',
    previewHtml: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
  <h2 style="color:#0055cc">Welcome to KrakenCam!</h2>
  <p>Hi {{first_name}},</p>
  <p>Your account is ready. Start capturing incredible footage and managing your team with ease.</p>
  <a href="https://app.krakencam.com" style="display:inline-block;background:#0055cc;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Go to KrakenCam →</a>
  <p style="color:#888;font-size:12px">You're on a free trial. No credit card required yet.</p>
</div>`,
  },
  {
    id: 'trial_ending',
    name: 'Trial Ending Soon',
    trigger: '3 days before trial ends',
    subject: 'Your KrakenCam trial ends in 3 days',
    status: 'active',
    previewHtml: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
  <h2 style="color:#d97706">Your trial is almost over</h2>
  <p>Hi {{first_name}},</p>
  <p>Your free trial ends in <strong>3 days</strong>. Upgrade now to keep all your data and continue with uninterrupted access.</p>
  <a href="https://app.krakencam.com/settings/billing" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Upgrade Now →</a>
</div>`,
  },
  {
    id: 'payment_failed',
    name: 'Payment Failed',
    trigger: 'When Stripe payment fails',
    subject: 'Action required: Payment failed for KrakenCam',
    status: 'active',
    previewHtml: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
  <h2 style="color:#dc2626">Payment Failed</h2>
  <p>Hi {{org_name}} team,</p>
  <p>We were unable to process your payment. Please update your billing information to avoid service interruption.</p>
  <a href="https://app.krakencam.com/settings/billing" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Update Billing →</a>
  <p style="color:#888;font-size:12px">We'll retry in 3 days. After 3 failed attempts, your account will be suspended.</p>
</div>`,
  },
  {
    id: 'subscription_cancelled',
    name: 'Subscription Cancelled',
    trigger: 'When subscription is cancelled',
    subject: 'Your KrakenCam subscription has been cancelled',
    status: 'active',
    previewHtml: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
  <h2 style="color:#6b7280">Subscription Cancelled</h2>
  <p>Hi {{first_name}},</p>
  <p>Your KrakenCam subscription has been cancelled. You'll retain access until the end of your current billing period.</p>
  <p>Your data will be available for <strong>60 days</strong> after cancellation.</p>
  <a href="https://app.krakencam.com/settings/billing" style="display:inline-block;background:#374151;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Reactivate →</a>
</div>`,
  },
  {
    id: 'account_deletion_warning',
    name: '⚠️ Account Deletion Warning',
    trigger: 'Auto-sent 15 days before permanent data deletion (daily cron at 10am UTC)',
    subject: '⚠️ Your KrakenCam data will be permanently deleted in 15 days',
    status: 'active',
    previewHtml: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
  <div style="background:linear-gradient(135deg,#1e1e2e,#2d1b69);padding:28px;text-align:center;border-radius:12px 12px 0 0">
    <div style="font-size:36px">🦑</div>
    <div style="color:#fff;font-size:18px;font-weight:800;margin-top:8px">Your account data is about to be permanently deleted</div>
  </div>
  <div style="background:#dc2626;padding:10px;text-align:center">
    <span style="color:#fff;font-weight:700;font-size:13px">⏰ PERMANENT DELETION IN 15 DAYS</span>
  </div>
  <div style="padding:28px">
    <p>Hi {{first_name}},</p>
    <p>Your <strong>{{org_name}}</strong> KrakenCam account was cancelled. <strong style="color:#dc2626">All your data will be permanently deleted on {{deletion_date}}.</strong></p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
      <strong style="color:#dc2626">What will be deleted:</strong> All photos, videos, reports, checklists, voice notes, project timelines, and team records.
    </div>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
      <strong>📥 Haven't downloaded your data?</strong><br/>Sign back in → Settings → <strong>Export My Data</strong> to download everything before deletion.
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="https://app.krakencam.com" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800">✅ Reactivate My Account →</a>
    </div>
  </div>
</div>`,
  },
  {
    id: 'password_reset',
    name: 'Password Reset',
    trigger: 'On password reset request',
    subject: '(Managed by Supabase Auth)',
    status: 'supabase',
    previewHtml: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111;text-align:center;padding:32px">
  <div style="font-size:48px">🔐</div>
  <h2 style="color:#6b7280">Managed by Supabase Auth</h2>
  <p style="color:#888">Password reset emails are handled directly by Supabase Authentication. Customize them in the Supabase dashboard under Authentication → Email Templates.</p>
  <a href="https://supabase.com/dashboard" style="color:#0055cc">Open Supabase Dashboard →</a>
</div>`,
  },
]

// ── Sub-components ───────────────────────────────────────────────────────────

function PreviewModal({ template, onClose }) {
  if (!template) return null
  // Use current editable state: body_html (DB field) or previewHtml (fallback)
  const html = template.body_html ?? template.previewHtml ?? ''
  const trigger = template.trigger_event ?? template.trigger ?? ''
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8e8' }}>
              Preview: {template.name}
            </div>
            <div style={{ fontSize: 11, color: '#9aaabb', marginTop: 3 }}>{trigger}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px 24px', overflowY: 'auto' }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <div style={{ fontSize: 11, color: '#8b9ab8', fontStyle: 'italic' }}>
          Note: {'{{'} variables {'}}' } will be replaced at send time. This is a preview only — actual delivery is handled by the backend.
        </div>
        <button onClick={onClose} style={S.btn}>Close Preview</button>
      </div>
    </div>
  )
}

function ConfirmModal({ title, message, onConfirm, onClose, confirmLabel = 'Confirm', danger = false }) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalBox, minWidth: 380, maxWidth: 460, gap: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: danger ? '#ff6b6b' : '#e8e8e8' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={S.btnGhost} onClick={onClose}>Cancel</button>
          <button style={danger ? S.btnDanger : S.btn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function WebhookModal({ onClose }) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalBox, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8e8' }}>🔗 Testing Webhooks</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <ol style={{ color: '#aaa', fontSize: 13, lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
          <li>Go to the <a href="https://dashboard.stripe.com/test/webhooks" target="_blank" rel="noreferrer" style={{ color: '#00d4ff' }}>Stripe Dashboard → Webhooks</a></li>
          <li>Select your KrakenCam endpoint</li>
          <li>Click <strong style={{ color: '#e8e8e8' }}>"Send test event"</strong></li>
          <li>Choose an event type (e.g. <code style={S.code}>checkout.session.completed</code>)</li>
          <li>Click <strong style={{ color: '#e8e8e8' }}>Send test webhook</strong></li>
          <li>Check the event log for delivery status</li>
        </ol>
        <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#aaa' }}>
          💡 Tip: You can also use the <code style={S.code}>stripe listen --forward-to localhost:5173/api/stripe-webhook</code> CLI command for local testing.
        </div>
        <button onClick={onClose} style={S.btn}>Got It</button>
      </div>
    </div>
  )
}

// ── Tab panels ───────────────────────────────────────────────────────────────

function GeneralTab() {
  const [supportEmail, setSupportEmail] = useState('support@krakencam.com')
  const [currentVersion, setCurrentVersion] = useState('—')
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'general').single()
      .then(({ data }) => { if (data?.value?.supportEmail) setSupportEmail(data.value.supportEmail) })
      .catch(() => {})
    // Load latest published version from app_versions
    const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(`${SUPABASE_URL}/rest/v1/app_versions?published=eq.true&order=release_date.desc&limit=1&select=version,title`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data) && data[0]) setCurrentVersion(`v${data[0].version}${data[0].title ? ` — ${data[0].title}` : ''}`)
    }).catch(() => {})
  }, [])

  async function handleSave() {
    setSaved('saving')
    try {
      const { error } = await supabase.from('app_settings').upsert({
        key: 'general',
        value: { supportEmail },
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setSaved('ok')
    } catch (e) {
      console.error('General save error:', e)
      setSaved('error')
    }
    setTimeout(() => setSaved(null), 3000)
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionHeader}>Platform</div>

        <div style={S.row}>
          <span style={S.label}>Platform Name</span>
          <div style={S.readOnly}>KrakenCam</div>
        </div>
        <div style={S.row}>
          <span style={S.label}>App URL</span>
          <div style={S.readOnly}>https://app.krakencam.com</div>
        </div>
        <div style={S.row}>
          <span style={S.label}>Current Version</span>
          <div style={S.readOnly}>{currentVersion}</div>
        </div>
        <div style={S.row}>
          <span style={S.label}>Supabase Project</span>
          <div style={S.readOnly}>nszoateefidwhhsyexjd</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>Email Addresses</div>

        <div style={S.row}>
          <span style={S.label}>Admin / Backend</span>
          <div style={S.readOnly}>krakencamco@gmail.com</div>
          <span style={{ fontSize:11, color:'#8b9ab8' }}>Admin logins, backend ops</span>
        </div>
        <div style={S.row}>
          <span style={S.label}>General / Sales</span>
          <div style={S.readOnly}>info@krakencam.com</div>
          <span style={{ fontSize:11, color:'#8b9ab8' }}>General inquiries, sales, form submissions</span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Support</span>
          <input
            style={S.input}
            value={supportEmail}
            onChange={e => setSupportEmail(e.target.value)}
            placeholder="support@krakencam.com"
          />
          <span style={{ fontSize:11, color:'#8b9ab8' }}>Support issues, reply-to on emails</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button style={S.btn} onClick={handleSave} disabled={saved === 'saving'}>
            {saved === 'saving' ? '⏳ Saving…' : 'Save Changes'}
          </button>
          {saved === 'ok'    && <span style={S.statusMsg(true)}>✓ Saved</span>}
          {saved === 'error' && <span style={S.statusMsg(false)}>✗ Failed to save</span>}
        </div>
      </div>
    </div>
  )
}

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState(
    EMAIL_TEMPLATES.map(t => ({ ...t, body_html: t.previewHtml }))
  )
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [saveStatus, setSaveStatus] = useState({}) // { [id]: 'saving' | 'saved' | 'error' }
  const [loadError, setLoadError] = useState(false)

  // Load templates from DB on mount — raw fetch to bypass Brave IndexedDB lock
  React.useEffect(() => {
    const url     = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(`${url}/rest/v1/email_templates?select=*`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTemplates(prev => prev.map(local => {
            const dbRow = data.find(d => d.id === local.id)
            if (!dbRow) return local
            return { ...local, subject: dbRow.subject, body_html: dbRow.body_html, enabled: dbRow.enabled }
          }))
        }
      })
      .catch(err => { console.warn('EmailTemplatesTab: load failed, using defaults', err); setLoadError(true) })
  }, [])

  function handleSubjectChange(id, val) {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, subject: val } : t))
  }

  function handleBodyChange(id, val) {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, body_html: val } : t))
  }

  async function handleSave(t) {
    setSaveStatus(prev => ({ ...prev, [t.id]: 'saving' }))
    try {
      const url     = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${url}/rest/v1/email_templates`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: t.id, name: t.name, trigger_event: t.trigger_event ?? t.trigger, subject: t.subject, body_html: t.body_html ?? t.previewHtml, enabled: t.enabled ?? true, updated_at: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaveStatus(prev => ({ ...prev, [t.id]: 'saved' }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [t.id]: null })), 2000)
    } catch (err) {
      console.error('Save template error:', err)
      setSaveStatus(prev => ({ ...prev, [t.id]: 'error' }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [t.id]: null })), 3000)
    }
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionHeader}>Email Templates</div>
        <div style={{ fontSize: 12, color: '#8b9ab8', marginBottom: 16, lineHeight: 1.6 }}>
          {loadError
            ? '⚠️ Could not load templates from database — showing defaults. DB changes will still be attempted on save.'
            : 'Click a template row to expand and edit its subject and HTML body. Password Reset is managed by Supabase Auth.'}
        </div>

        {templates.map((t, i) => {
          const isSupabase = t.status === 'supabase'
          const isExpanded = expandedId === t.id
          const status = saveStatus[t.id]

          return (
            <div key={t.id} style={{ borderBottom: i < templates.length - 1 ? '1px solid rgba(30,60,120,0.15)' : 'none' }}>
              {/* Collapsed row — click to expand */}
              <div
                style={{
                  ...S.templateRow,
                  borderBottom: 'none',
                  cursor: isSupabase ? 'default' : 'pointer',
                  background: isExpanded ? 'rgba(0,212,255,0.04)' : 'transparent',
                  borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                  padding: '12px 10px',
                  transition: 'background 0.15s',
                }}
                onClick={() => !isSupabase && setExpandedId(isExpanded ? null : t.id)}
              >
                <div style={{ minWidth: 200, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!isSupabase && (
                      <span style={{ fontSize: 11, color: '#8b9ab8', transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    )}
                    {t.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#8b9ab8', marginTop: 2 }}>
                    {t.trigger_event ?? t.trigger}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.subject}
                  </div>
                </div>

                <span style={S.badge(isSupabase ? 'gray' : 'green')}>
                  {isSupabase ? 'Supabase Managed' : 'Active'}
                </span>

                <button
                  style={S.btnGhost}
                  onClick={e => { e.stopPropagation(); setPreviewTemplate(t) }}
                >
                  Preview
                </button>
              </div>

              {/* Expanded editor */}
              {isExpanded && !isSupabase && (
                <div style={{
                  background: 'rgba(0,5,15,0.5)',
                  borderRadius: '0 0 8px 8px',
                  padding: '16px 10px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  borderTop: '1px solid rgba(0,212,255,0.1)',
                }}>
                  {/* Subject */}
                  <div>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      Subject Line
                    </label>
                    <input
                      style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                      value={t.subject}
                      onChange={e => handleSubjectChange(t.id, e.target.value)}
                      placeholder="Email subject..."
                    />
                  </div>

                  {/* Body HTML */}
                  <div>
                    <label style={{ fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      Body HTML
                    </label>
                    <textarea
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#0d1017',
                        border: '1px solid #1e2638',
                        borderRadius: 8,
                        color: '#c9d1d9',
                        padding: '10px 12px',
                        fontSize: 12,
                        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', 'Courier New', monospace",
                        lineHeight: 1.6,
                        outline: 'none',
                        resize: 'vertical',
                        minHeight: 220,
                      }}
                      rows={12}
                      value={t.body_html ?? ''}
                      onChange={e => handleBodyChange(t.id, e.target.value)}
                      placeholder="<div>Email HTML body...</div>"
                    />
                    <div style={{ fontSize: 11, color: '#7a8a9a', marginTop: 4 }}>
                      Supports {'{{first_name}}'}, {'{{org_name}}'}, {'{{trial_end_date}}'} and other template variables.
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      style={S.btnGhost}
                      onClick={() => setPreviewTemplate(t)}
                    >
                      👁 Preview
                    </button>
                    <button
                      style={{
                        ...S.btn,
                        opacity: status === 'saving' ? 0.6 : 1,
                        cursor: status === 'saving' ? 'not-allowed' : 'pointer',
                      }}
                      disabled={status === 'saving'}
                      onClick={() => handleSave(t)}
                    >
                      {status === 'saving' ? '⏳ Saving…' : status === 'saved' ? '✓ Saved!' : status === 'error' ? '✗ Error' : '💾 Save'}
                    </button>
                    {status === 'saved' && (
                      <span style={S.statusMsg(true)}>Template saved to database</span>
                    )}
                    {status === 'error' && (
                      <span style={S.statusMsg(false)}>Save failed — check console</span>
                    )}
                  </div>
                </div>
              )}

              {/* Supabase-managed note when expanded would be — show inline */}
              {isSupabase && (
                <div style={{ padding: '0 10px 14px', fontSize: 12, color: '#8b9ab8', fontStyle: 'italic' }}>
                  🔐 Managed by Supabase Auth. Customize at{' '}
                  <a href="https://supabase.com/dashboard/project/nszoateefidwhhsyexjd/auth/templates" target="_blank" rel="noreferrer" style={{ color: '#00d4ff' }}>
                    Supabase → Auth → Email Templates
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {previewTemplate && <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />}
    </div>
  )
}

function WebhookTab() {
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    // Only copying a masked value — real secret retrieval would be server-side
    navigator.clipboard.writeText('whsec_••••••••').catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const events = [
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
  ]

  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionHeader}>Stripe Webhook</div>

        <div style={S.row}>
          <span style={S.label}>Endpoint URL</span>
          <div style={{ ...S.readOnly, fontFamily: 'monospace', fontSize: 12, width: 'auto', flex: 1, maxWidth: 420 }}>
            https://app.krakencam.com/api/stripe-webhook
          </div>
        </div>

        <div style={S.row}>
          <span style={S.label}>Status</span>
          <span style={S.badge('yellow')}>Configured – Test Mode</span>
        </div>

        <div style={S.row}>
          <span style={S.label}>Webhook Secret</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...S.readOnly, fontFamily: 'monospace', fontSize: 13, letterSpacing: 1 }}>
              whsec_••••••••
            </div>
            <button style={S.btnGhost} onClick={handleCopy} title="Copy to clipboard">
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
        </div>

        <hr style={S.divider} />

        <div style={S.sectionHeader}>Listening to Events</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(ev => (
            <div key={ev} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#4ec9b0', fontSize: 12 }}>✓</span>
              <code style={{ ...S.code, fontSize: 12 }}>{ev}</code>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <button style={S.btn} onClick={() => setShowWebhookModal(true)}>
            🔗 Test Webhook
          </button>
        </div>
      </div>

      {showWebhookModal && <WebhookModal onClose={() => setShowWebhookModal(false)} />}
    </div>
  )
}

function SecurityTab() {
  const [sessionTimeout, setSessionTimeout] = useState('8h')
  const [saved, setSaved] = useState(null) // null | 'saving' | 'ok' | 'error'

  // Load saved value on mount
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'session_policy').single()
      .then(({ data }) => { if (data?.value?.sessionTimeout) setSessionTimeout(data.value.sessionTimeout) })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaved('saving')
    try {
      const { error } = await supabase.from('app_settings').upsert({
        key: 'session_policy',
        value: { sessionTimeout },
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setSaved('ok')
    } catch (e) {
      console.error('Security save error:', e)
      setSaved('error')
    }
    setTimeout(() => setSaved(null), 3000)
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionHeader}>Access Control</div>

        <div style={S.row}>
          <span style={S.label}>Super Admin Email</span>
          <div style={S.readOnly}>krakencamco@gmail.com</div>
        </div>

        <div style={S.row}>
          <span style={S.label}>Two-Factor Auth</span>
          <span style={S.badge('blue')}>Managed by Supabase Auth</span>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>Session Policy</div>

        <div style={S.row}>
          <span style={S.label}>Admin Session Timeout</span>
          <select
            style={S.select}
            value={sessionTimeout}
            onChange={e => setSessionTimeout(e.target.value)}
          >
            <option value="1h">1 Hour</option>
            <option value="8h">8 Hours</option>
            <option value="24h">24 Hours</option>
            <option value="never">Never</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button style={S.btn} onClick={handleSave} disabled={saved === 'saving'}>
            {saved === 'saving' ? '⏳ Saving…' : 'Save Session Policy'}
          </button>
          {saved === 'ok'    && <span style={S.statusMsg(true)}>✓ Saved</span>}
          {saved === 'error' && <span style={S.statusMsg(false)}>✗ Failed to save</span>}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>Data & Compliance</div>

        <div style={S.row}>
          <span style={S.label}>Data Retention</span>
          <div style={S.readOnly}>60 days after cancellation</div>
          <span style={{ fontSize: 11, color: '#8b9ab8' }}>per ToS</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            style={S.btnGhost}
            onClick={() => { window.history.pushState({}, '', '/admin'); window.dispatchEvent(new CustomEvent('kc-admin-nav', { detail: 'audit_log' })) }}
          >
            📋 View Audit Log
          </button>
        </div>
      </div>
    </div>
  )
}

function DangerZoneTab() {
  const [snapshotStatus, setSnapshotStatus] = useState(null) // null | 'loading' | 'ok' | 'error'
  const [exportStatus, setExportStatus] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'snapshot' | 'export' | null

  // ── Maintenance mode ──
  const [maintEnabled,  setMaintEnabled]  = useState(false)
  const [maintMessage,  setMaintMessage]  = useState("We are performing scheduled maintenance. We'll be back shortly.")
  const [maintStatus,   setMaintStatus]   = useState(null) // null | 'saving' | 'ok' | 'error'
  const [maintLoaded,   setMaintLoaded]   = useState(false)

  useEffect(() => {
    supabase.rpc('get_maintenance_mode')
      .then(({ data }) => {
        if (data) {
          setMaintEnabled(!!data.enabled)
          setMaintMessage(data.message || "We are performing scheduled maintenance. We'll be back shortly.")
        }
        setMaintLoaded(true)
      })
      .catch(() => setMaintLoaded(true))
  }, [])

  async function saveMaintenance(enabled) {
    setMaintStatus('saving')
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'maintenance_mode', value: { enabled, message: maintMessage }, updated_by: (await supabase.auth.getUser()).data?.user?.id })
      if (error) throw error
      setMaintEnabled(enabled)
      setMaintStatus('ok')
    } catch (err) {
      console.error('Maintenance save error:', err)
      setMaintStatus('error')
    }
    setTimeout(() => setMaintStatus(null), 4000)
  }

  async function triggerSnapshot() {
    setConfirm(null)
    setSnapshotStatus('loading')
    try {
      const { error } = await supabase.rpc('upsert_analytics_snapshot')
      if (error) throw error
      setSnapshotStatus('ok')
    } catch (err) {
      console.error('Snapshot error:', err)
      setSnapshotStatus('error')
    }
    setTimeout(() => setSnapshotStatus(null), 5000)
  }

  async function exportOrgs() {
    setConfirm(null)
    setExportStatus('loading')
    try {
      const rows = await getAllOrganizations()
      const csv = [
        ['Name', 'Slug', 'Tier', 'Status', 'Created'].join(','),
        ...rows.map(o => [
          JSON.stringify(o.name || ''),
          JSON.stringify(o.slug || ''),
          o.subscription_tier || '',
          o.subscription_status || '',
          o.created_at || '',
        ].join(',')),
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'krakencam-organizations.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportStatus('ok')
    } catch (err) {
      console.error('Export error:', err)
      setExportStatus('error')
    }
    setTimeout(() => setExportStatus(null), 5000)
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionHeader}>Maintenance</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Maintenance Mode Toggle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>
                  🔧 Maintenance Mode
                </div>
                <div style={{ fontSize: 12, color: '#9aaabb', lineHeight: 1.5 }}>
                  When enabled, all users see a maintenance screen. Admins on <code style={S.code}>/admin</code> are unaffected.
                </div>
              </div>
              <button
                onClick={() => saveMaintenance(!maintEnabled)}
                disabled={!maintLoaded || maintStatus === 'saving'}
                style={{
                  flexShrink: 0, marginLeft: 20, padding: '8px 18px', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: maintEnabled ? '#dc3c3c' : '#3dba7e',
                  color: 'white', opacity: maintStatus === 'saving' ? 0.6 : 1,
                  transition: 'all .15s',
                }}
              >
                {maintStatus === 'saving' ? '⏳ Saving…' : maintEnabled ? '🔴 Maintenance ON — Click to Disable' : '✅ Maintenance OFF — Click to Enable'}
              </button>
            </div>
            {/* Custom message */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Custom message shown to users:</div>
              <textarea
                value={maintMessage}
                onChange={e => setMaintMessage(e.target.value)}
                rows={2}
                style={{ width: '100%', boxSizing: 'border-box', background: '#0f1521', border: '1px solid rgba(30,60,120,0.4)', borderRadius: 8, color: '#e8e8e8', fontSize: 12, padding: '8px 12px', resize: 'vertical', fontFamily: 'Inter, sans-serif' }}
              />
            </div>
            {maintStatus === 'ok'    && <div style={{ fontSize: 12, color: '#3dba7e', marginTop: 6 }}>✓ Saved</div>}
            {maintStatus === 'error' && <div style={{ fontSize: 12, color: '#dc3c3c', marginTop: 6 }}>✗ Failed to save — check console</div>}
          </div>

          <hr style={S.divider} />
          {/* Analytics Snapshot */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 4 }}>
              Trigger Analytics Snapshot
            </div>
            <div style={{ fontSize: 12, color: '#9aaabb', marginBottom: 10, lineHeight: 1.6 }}>
              Manually run <code style={S.code}>upsert_analytics_snapshot()</code> to refresh the analytics materialized data.
              This runs automatically on a schedule but can be triggered manually here.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                style={S.btn}
                onClick={() => setConfirm('snapshot')}
                disabled={snapshotStatus === 'loading'}
              >
                {snapshotStatus === 'loading' ? '⏳ Running...' : '⚡ Trigger Snapshot'}
              </button>
              {snapshotStatus === 'ok' && <span style={S.statusMsg(true)}>✓ Snapshot completed</span>}
              {snapshotStatus === 'error' && <span style={S.statusMsg(false)}>✗ Snapshot failed — check console</span>}
            </div>
          </div>

          <hr style={S.divider} />

          {/* Export Orgs */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 4 }}>
              Export All Organizations
            </div>
            <div style={{ fontSize: 12, color: '#9aaabb', marginBottom: 10, lineHeight: 1.6 }}>
              Download a CSV of all organizations including name, slug, subscription tier, status, and creation date.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                style={S.btn}
                onClick={() => setConfirm('export')}
                disabled={exportStatus === 'loading'}
              >
                {exportStatus === 'loading' ? '⏳ Exporting...' : '📥 Export CSV'}
              </button>
              {exportStatus === 'ok' && <span style={S.statusMsg(true)}>✓ Download started</span>}
              {exportStatus === 'error' && <span style={S.statusMsg(false)}>✗ Export failed — check console</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation modals */}
      {confirm === 'snapshot' && (
        <ConfirmModal
          title="⚡ Trigger Analytics Snapshot"
          message="This will call upsert_analytics_snapshot() and refresh the analytics data immediately. Proceed?"
          confirmLabel="Run Snapshot"
          onConfirm={triggerSnapshot}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'export' && (
        <ConfirmModal
          title="📥 Export All Organizations"
          message="This will download a CSV containing all organization data. Make sure you handle this file securely."
          confirmLabel="Export CSV"
          onConfirm={exportOrgs}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

// ── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const blank = { title: '', message: '', scheduled_date: '', start_time: '', end_time: '', target: 'all', active: true }
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)

  const load = () => {
    setLoading(true)
    supabase.from('app_announcements').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setAnnouncements(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(blank); setEditId(null); setShowForm(true) }
  const openEdit = (a) => {
    setForm({
      title: a.title, message: a.message,
      scheduled_date: a.scheduled_date || '', start_time: a.start_time || '',
      end_time: a.end_time || '', target: a.target, active: a.active,
    })
    setEditId(a.id); setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim() || !form.message.trim()) return
    setSaving(true); setSaveStatus(null)
    try {
      const payload = {
        title: form.title.trim(), message: form.message.trim(),
        scheduled_date: form.scheduled_date || null,
        start_time: form.start_time || null, end_time: form.end_time || null,
        target: form.target, active: form.active,
        updated_at: new Date().toISOString(),
      }
      if (editId) {
        const { error } = await supabase.from('app_announcements').update(payload).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('app_announcements').insert(payload)
        if (error) throw error
      }
      setSaveStatus('ok'); setShowForm(false); load()
    } catch (e) { console.error(e); setSaveStatus('error') }
    setSaving(false)
  }

  const toggle = async (a) => {
    await supabase.from('app_announcements').update({ active: !a.active }).eq('id', a.id)
    load()
  }

  const del = async (id) => {
    if (!window.confirm('Delete this announcement?')) return
    await supabase.from('app_announcements').delete().eq('id', id)
    load()
  }

  const inp = { background: '#0a0f1a', border: '1px solid rgba(30,60,120,0.4)', borderRadius: 8, color: '#e8e8e8', fontSize: 13, padding: '8px 12px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  return (
    <div>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={S.sectionHeader}>📣 App Announcements</div>
            <div style={{ fontSize: 12, color: '#9aaabb', marginTop: 2 }}>Push a popup notice to all users, admins, or managers. Users dismiss it once and won't see it again.</div>
          </div>
          <button style={{ ...S.btn, flexShrink: 0, marginLeft: 16 }} onClick={openNew}>+ New Announcement</button>
        </div>

        {loading && <div style={{ color: '#9aaabb', fontSize: 13 }}>Loading…</div>}
        {!loading && !announcements.length && <div style={{ color: '#9aaabb', fontSize: 13 }}>No announcements yet.</div>}

        {!loading && announcements.map(a => (
          <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8e8e8' }}>{a.title}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: a.active ? 'rgba(61,186,126,.15)' : 'rgba(255,255,255,.05)', color: a.active ? '#3dba7e' : '#666', fontWeight: 600 }}>{a.active ? 'Active' : 'Inactive'}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,.05)', color: '#8b9ab8' }}>{a.target === 'all' ? '👥 All users' : a.target === 'admins' ? '🔑 Admins' : '👔 Managers'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#8b9ab8', marginBottom: 4, whiteSpace: 'pre-wrap' }}>{a.message}</div>
              {(a.scheduled_date || a.start_time) && (
                <div style={{ fontSize: 11, color: '#fbbf24' }}>
                  🗓 {a.scheduled_date || ''}{a.start_time ? ` · ${a.start_time}–${a.end_time}` : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => toggle(a)} style={{ ...S.btn, fontSize: 11, padding: '4px 10px', background: a.active ? 'rgba(220,60,60,.15)' : 'rgba(61,186,126,.15)', color: a.active ? '#e85a3a' : '#3dba7e', border: `1px solid ${a.active ? 'rgba(220,60,60,.3)' : 'rgba(61,186,126,.3)'}` }}>{a.active ? 'Disable' : 'Enable'}</button>
              <button onClick={() => openEdit(a)} style={{ ...S.btn, fontSize: 11, padding: '4px 10px' }}>Edit</button>
              <button onClick={() => del(a.id)} style={{ ...S.btn, fontSize: 11, padding: '4px 10px', background: 'rgba(220,60,60,.1)', color: '#e85a3a', border: '1px solid rgba(220,60,60,.3)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ background: '#0f1521', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>{editId ? '✏️ Edit Announcement' : '📣 New Announcement'}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Title *</div>
                <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Scheduled Maintenance" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Message *</div>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="We'll be down for maintenance on March 25 from 2:00 AM – 4:00 AM PDT." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Date (optional)</div>
                  <input style={inp} type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Start time</div>
                  <input style={inp} type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>End time</div>
                  <input style={inp} type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Show to</div>
                <select style={inp} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}>
                  <option value="all">👥 All users</option>
                  <option value="admins">🔑 Admins only</option>
                  <option value="managers">👔 Managers + Admins</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="ann-active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                <label htmlFor="ann-active" style={{ fontSize: 13, color: '#e8e8e8', cursor: 'pointer' }}>Active (visible to users immediately)</label>
              </div>
            </div>

            {saveStatus === 'error' && <div style={{ fontSize: 12, color: '#e85a3a', marginTop: 12 }}>✗ Failed to save — check console</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...S.btn, flex: 2, background: 'rgba(37,99,235,.2)', color: '#60a5fa', border: '1px solid rgba(37,99,235,.3)' }} onClick={save} disabled={saving}>
                {saving ? '⏳ Saving…' : editId ? '✓ Save Changes' : '📣 Create Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',    label: '⚙️ General' },
  { id: 'email',         label: '✉️ Email Templates' },
  { id: 'webhooks',      label: '🔗 Webhooks' },
  { id: 'security',      label: '🔒 Security' },
  { id: 'announcements', label: '📣 Announcements' },
  { id: 'danger',        label: '⚠️ Danger Zone' },
]

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general')

  function renderTab() {
    switch (activeTab) {
      case 'general':       return <GeneralTab />
      case 'email':         return <EmailTemplatesTab />
      case 'webhooks':      return <WebhookTab />
      case 'security':      return <SecurityTab />
      case 'announcements': return <AnnouncementsTab />
      case 'danger':        return <DangerZoneTab />
      default:              return <GeneralTab />
    }
  }

  return (
    <div style={S.root}>
      <div style={S.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={S.tab(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {renderTab()}
    </div>
  )
}
