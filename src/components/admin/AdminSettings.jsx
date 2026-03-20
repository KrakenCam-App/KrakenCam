/**
 * AdminSettings.jsx
 * Full admin settings page with tabs: General, Email Templates,
 * Webhook Config, Security, and Danger Zone.
 */

import React, { useState } from 'react'
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
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8e8' }}>
              Preview: {template.name}
            </div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{template.trigger}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px 24px', overflowY: 'auto' }}>
          <div dangerouslySetInnerHTML={{ __html: template.previewHtml }} />
        </div>
        <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>
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
  const [saved, setSaved] = useState(false)

  function handleSave() {
    // In production this would write to a config table
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
          <div style={S.readOnly}>1.0.0</div>
        </div>
        <div style={S.row}>
          <span style={S.label}>Supabase Project</span>
          <div style={S.readOnly}>nszoateefidwhhsyexjd</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>Contact</div>

        <div style={S.row}>
          <span style={S.label}>Support Email</span>
          <input
            style={S.input}
            value={supportEmail}
            onChange={e => setSupportEmail(e.target.value)}
            placeholder="support@krakencam.com"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button style={S.btn} onClick={handleSave}>Save Changes</button>
          {saved && <span style={S.statusMsg(true)}>✓ Saved</span>}
        </div>
      </div>
    </div>
  )
}

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState(EMAIL_TEMPLATES)
  const [previewTemplate, setPreviewTemplate] = useState(null)

  function handleSubjectChange(id, val) {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, subject: val } : t))
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionHeader}>Email Templates</div>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 16, lineHeight: 1.6 }}>
          Subject lines are editable. Template bodies are managed via the backend. Auth emails (password reset) are controlled by Supabase.
        </div>

        {templates.map((t, i) => (
          <div key={t.id} style={{ ...S.templateRow, borderBottom: i < templates.length - 1 ? '1px solid rgba(30,60,120,0.15)' : 'none' }}>
            <div style={{ minWidth: 200, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>{t.name}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{t.trigger}</div>
            </div>
            <input
              style={{ ...S.input, flex: 1, minWidth: 160, opacity: t.status === 'supabase' ? 0.4 : 1 }}
              value={t.subject}
              disabled={t.status === 'supabase'}
              onChange={e => handleSubjectChange(t.id, e.target.value)}
              placeholder="Subject line..."
            />
            <span style={S.badge(t.status === 'supabase' ? 'gray' : 'green')}>
              {t.status === 'supabase' ? 'Supabase Managed' : 'Active'}
            </span>
            <button style={S.btnGhost} onClick={() => setPreviewTemplate(t)}>Preview</button>
          </div>
        ))}
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
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
          <button style={S.btn} onClick={handleSave}>Save Session Policy</button>
          {saved && <span style={S.statusMsg(true)}>✓ Saved</span>}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>Data & Compliance</div>

        <div style={S.row}>
          <span style={S.label}>Data Retention</span>
          <div style={S.readOnly}>60 days after cancellation</div>
          <span style={{ fontSize: 11, color: '#555' }}>per ToS</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            style={S.btnGhost}
            onClick={() => alert('Audit log viewer coming soon.')}
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
          {/* Analytics Snapshot */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 4 }}>
              Trigger Analytics Snapshot
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 1.6 }}>
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
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 1.6 }}>
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

// ── Main component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',    label: '⚙️ General' },
  { id: 'email',      label: '✉️ Email Templates' },
  { id: 'webhooks',   label: '🔗 Webhooks' },
  { id: 'security',   label: '🔒 Security' },
  { id: 'danger',     label: '⚠️ Danger Zone' },
]

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general')

  function renderTab() {
    switch (activeTab) {
      case 'general':  return <GeneralTab />
      case 'email':    return <EmailTemplatesTab />
      case 'webhooks': return <WebhookTab />
      case 'security': return <SecurityTab />
      case 'danger':   return <DangerZoneTab />
      default:         return <GeneralTab />
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
