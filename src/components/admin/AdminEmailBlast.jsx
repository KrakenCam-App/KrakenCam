/**
 * AdminEmailBlast.jsx
 * Send one-off email blasts to all users, a tier, or trial users.
 */

import React, { useState } from 'react'

const S = {
  card: { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'22px 24px', marginBottom:16 },
  sectionTitle: { fontSize:14, fontWeight:600, color:'#ccc', marginBottom:12, letterSpacing:.3 },
  label: { fontSize:12, color:'#888', marginBottom:6, display:'block', fontWeight:500 },
  input: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'9px 12px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  textarea: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'9px 12px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif', resize:'vertical', minHeight:200, lineHeight:1.6 },
  select: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'9px 12px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  btn: (color='#2563eb') => ({ background:`rgba(${color==='green'?'34,197,94':'37,99,235'},.15)`, border:`1px solid rgba(${color==='green'?'34,197,94':'37,99,235'},.3)`, color: color==='green'?'#4ade80':'#60a5fa', borderRadius:8, padding:'10px 20px', fontSize:13, cursor:'pointer', fontWeight:700 }),
  badge: (c) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${c}22`, color:c, border:`1px solid ${c}44` }),
  preview: { background:'#fff', borderRadius:10, padding:'28px', color:'#111', fontSize:14, lineHeight:1.7, border:'1px solid #e5e7eb', marginTop:12 },
  result: (ok) => ({ background: ok?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)', border:`1px solid ${ok?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`, borderRadius:10, padding:'14px 18px', marginTop:12, fontSize:13, color: ok?'#4ade80':'#f87171' }),
}

const TARGETS = [
  { value:'all',            label:'👥 All users (admin per org)',  desc:'One email per organization admin' },
  { value:'trialing',       label:'⏳ Trial users',                desc:'All orgs currently on free trial' },
  { value:'active',         label:'✅ Paying customers',           desc:'All active (paid) organizations' },
  { value:'capture_i',      label:'📷 Capture I',                  desc:'Active Capture I orgs only' },
  { value:'intelligence_ii',label:'🧠 Intelligence II',            desc:'Active Intelligence II orgs only' },
  { value:'command_iii',    label:'⚡ Command III',                 desc:'Active Command III orgs only' },
]

const TEMPLATES = [
  {
    id: 'feature',
    label: '🚀 New Feature Announcement',
    subject: '✨ New in KrakenCam: {{feature_name}}',
    html: `<div style="font-family:Inter,sans-serif;max-width:580px;margin:auto;background:#0a0c10;color:#e8e8e8;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e3a8a,#0ea5e9);padding:32px 28px;text-align:center">
    <div style="font-size:40px;margin-bottom:12px">🦑</div>
    <div style="font-size:22px;font-weight:700;color:white">Something new just dropped</div>
  </div>
  <div style="padding:32px 28px">
    <p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">We just launched <strong style="color:#38bdf8">{{feature_name}}</strong> — and we think you're going to love it.</p>
    <p style="margin:0 0 24px">{{feature_description}}</p>
    <a href="https://app.krakencam.com" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Try it now →</a>
  </div>
  <div style="padding:20px 28px;border-top:1px solid #1e2638;text-align:center;font-size:11px;color:#4a5568">
    KrakenCam · <a href="mailto:support@krakencam.com" style="color:#4a5568">support@krakencam.com</a>
  </div>
</div>`,
  },
  {
    id: 'maintenance',
    label: '🔧 Scheduled Maintenance Notice',
    subject: '🔧 KrakenCam scheduled maintenance — {{date}}',
    html: `<div style="font-family:Inter,sans-serif;max-width:580px;margin:auto;background:#0a0c10;color:#e8e8e8;border-radius:16px;overflow:hidden">
  <div style="background:#1a1a2e;padding:32px 28px;text-align:center;border-bottom:1px solid #1e2638">
    <div style="font-size:40px;margin-bottom:12px">🔧</div>
    <div style="font-size:20px;font-weight:700;color:white">Scheduled Maintenance</div>
  </div>
  <div style="padding:32px 28px">
    <p style="margin:0 0 16px">Hi {{first_name}},</p>
    <p style="margin:0 0 16px">We have scheduled maintenance on <strong style="color:#fbbf24">{{date}}</strong> from <strong style="color:#fbbf24">{{start_time}}</strong> to <strong style="color:#fbbf24">{{end_time}}</strong> PDT.</p>
    <p style="margin:0 0 24px">KrakenCam will be unavailable during this window. We apologize for any inconvenience.</p>
    <p style="color:#8b9ab8;font-size:13px">No action is required on your part. Your data is safe.</p>
  </div>
  <div style="padding:20px 28px;border-top:1px solid #1e2638;text-align:center;font-size:11px;color:#4a5568">
    KrakenCam · <a href="mailto:support@krakencam.com" style="color:#4a5568">support@krakencam.com</a>
  </div>
</div>`,
  },
  {
    id: 'custom',
    label: '✏️ Custom email',
    subject: '',
    html: `<div style="font-family:Inter,sans-serif;max-width:580px;margin:auto;background:#0a0c10;color:#e8e8e8;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e3a8a,#0ea5e9);padding:32px 28px;text-align:center">
    <div style="font-size:40px;margin-bottom:12px">🦑</div>
  </div>
  <div style="padding:32px 28px">
    <p>Hi {{first_name}},</p>
    <p>Your message here.</p>
    <a href="https://app.krakencam.com" style="display:inline-block;background:#2563eb;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700">Open KrakenCam →</a>
  </div>
  <div style="padding:20px 28px;border-top:1px solid #1e2638;text-align:center;font-size:11px;color:#4a5568">
    KrakenCam · <a href="mailto:support@krakencam.com" style="color:#4a5568">support@krakencam.com</a>
  </div>
</div>`,
  },
]

export default function AdminEmailBlast() {
  const [target,      setTarget]      = useState('all')
  const [templateId,  setTemplateId]  = useState('feature')
  const [subject,     setSubject]     = useState(TEMPLATES[0].subject)
  const [html,        setHtml]        = useState(TEMPLATES[0].html)
  const [tab,         setTab]         = useState('compose') // compose | preview
  const [sending,     setSending]     = useState(false)
  const [dryRunning,  setDryRunning]  = useState(false)
  const [result,      setResult]      = useState(null)
  const [dryResult,   setDryResult]   = useState(null)
  const [confirmed,   setConfirmed]   = useState(false)

  const targetMeta = TARGETS.find(t => t.value === target)

  const applyTemplate = (id) => {
    setTemplateId(id)
    const tmpl = TEMPLATES.find(t => t.id === id)
    if (tmpl) { setSubject(tmpl.subject); setHtml(tmpl.html) }
    setResult(null); setDryResult(null); setConfirmed(false)
  }

  const dryRun = async () => {
    setDryRunning(true); setDryResult(null)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'krakencam-internal-2024',
        },
        body: JSON.stringify({ type: 'blast', subject, html, target, dry_run: true }),
      })
      const data = await res.json()
      setDryResult(data)
    } catch (e) { setDryResult({ error: e.message }) }
    setDryRunning(false)
  }

  const send = async () => {
    if (!confirmed) return
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'krakencam-internal-2024',
        },
        body: JSON.stringify({ type: 'blast', subject, html, target }),
      })
      const data = await res.json()
      setResult(data)
      setConfirmed(false)
    } catch (e) { setResult({ error: e.message }) }
    setSending(false)
  }

  return (
    <div>
      {/* Target + Template selectors */}
      <div style={S.card}>
        <div style={S.sectionTitle}>📣 Email Blast</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <div>
            <label style={S.label}>Send to</label>
            <select style={S.select} value={target} onChange={e => { setTarget(e.target.value); setResult(null); setDryResult(null); setConfirmed(false) }}>
              {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {targetMeta && <div style={{ fontSize:11, color:'#555', marginTop:5 }}>{targetMeta.desc}</div>}
          </div>
          <div>
            <label style={S.label}>Template</label>
            <select style={S.select} value={templateId} onChange={e => applyTemplate(e.target.value)}>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Subject line</label>
          <input style={S.input} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" />
          <div style={{ fontSize:11, color:'#555', marginTop:4 }}>Use {'{{first_name}}'} for personalisation</div>
        </div>

        {/* Compose / Preview tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:12, borderBottom:'1px solid #222', paddingBottom:0 }}>
          {['compose','preview'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'7px 16px', background:'transparent', border:'none', borderBottom: tab===t?'2px solid #00d4ff':'2px solid transparent', color:tab===t?'#00d4ff':'#666', fontSize:12, fontWeight:tab===t?600:400, cursor:'pointer', marginBottom:-1, textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>

        {tab === 'compose' && (
          <div>
            <label style={S.label}>HTML body — edit directly or paste your own</label>
            <textarea style={S.textarea} value={html} onChange={e => setHtml(e.target.value)} />
          </div>
        )}

        {tab === 'preview' && (
          <div>
            <div style={{ fontSize:11, color:'#555', marginBottom:8 }}>Preview (rendered HTML — {'{{first_name}}'} will be personalised per recipient)</div>
            <div style={S.preview} dangerouslySetInnerHTML={{ __html: html.replace(/\{\{first_name\}\}/gi, 'Riley') }} />
          </div>
        )}
      </div>

      {/* Dry run + Send */}
      <div style={S.card}>
        <div style={S.sectionTitle}>🚀 Send</div>

        {/* Dry run */}
        <div style={{ marginBottom:20 }}>
          <button style={S.btn()} disabled={dryRunning || !subject || !html} onClick={dryRun}>
            {dryRunning ? '⏳ Checking…' : '🔍 Check recipients (dry run)'}
          </button>
          {dryResult && !dryResult.error && (
            <div style={{ marginTop:10, fontSize:13, color:'#4ade80' }}>
              ✓ <strong>{dryResult.recipient_count}</strong> recipient{dryResult.recipient_count!==1?'s':''} will receive this email
              {dryResult.sample?.length > 0 && <span style={{ color:'#555', marginLeft:8 }}>({dryResult.sample.join(', ')}{dryResult.recipient_count > 5 ? '…' : ''})</span>}
            </div>
          )}
          {dryResult?.error && <div style={{ marginTop:8, fontSize:13, color:'#f87171' }}>✗ {dryResult.error}</div>}
        </div>

        {/* Confirm + Send */}
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#ccc' }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
            I've previewed the email and confirmed the recipients
          </label>
        </div>
        <div style={{ marginTop:12 }}>
          <button
            style={{ ...S.btn('green'), opacity: confirmed && !sending ? 1 : 0.45, cursor: confirmed && !sending ? 'pointer' : 'not-allowed' }}
            disabled={!confirmed || sending || !subject || !html}
            onClick={send}
          >
            {sending ? '⏳ Sending…' : `📨 Send to ${targetMeta?.label || target}`}
          </button>
        </div>

        {result && (
          <div style={S.result(!result.error && result.success)}>
            {result.error
              ? `✗ Error: ${result.error}`
              : `✓ Sent to ${result.sent} recipient${result.sent!==1?'s':''}${result.failed>0?` (${result.failed} failed)`:''}.${result.capped_at ? ` Capped at ${result.capped_at} per batch — run again for remaining.` : ''}`
            }
            {result.errors?.length > 0 && (
              <div style={{ marginTop:8, fontSize:11, color:'#f87171' }}>{result.errors.slice(0,5).join(', ')}</div>
            )}
          </div>
        )}

        <div style={{ marginTop:16, fontSize:12, color:'#444', lineHeight:1.7 }}>
          💡 <strong style={{ color:'#555' }}>Notes:</strong> Emails send from <code style={{ color:'#60a5fa' }}>noreply@krakencam.com</code> with reply-to <code style={{ color:'#60a5fa' }}>support@krakencam.com</code>.
          One email per org admin. Batches capped at 50 per send to stay within Resend limits.
          Use the dry run first to confirm recipient count.
        </div>
      </div>
    </div>
  )
}
