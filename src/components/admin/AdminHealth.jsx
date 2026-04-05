/**
 * AdminHealth.jsx — System Uptime & Incident History
 * Full-featured status & observability panel: uptime bars, incident CRUD,
 * maintenance windows, live monitoring, and public widget config.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { adminFrom, adminInsert, adminUpdate, adminDelete } from '../../lib/adminFetch'
import { supabase } from '../../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_CHECKS = [
  { table: 'organizations',   label: 'Organizations' },
  { table: 'profiles',        label: 'Users / Profiles' },
  { table: 'projects',        label: 'Projects' },
  { table: 'pictures',        label: 'Photos' },
  { table: 'tasks',           label: 'Tasks' },
  { table: 'audit_log',       label: 'Audit Log entries' },
  { table: 'file_annotations',label: 'PDF Annotations' },
]

const SEVERITY = {
  critical:    { label: 'Critical',    color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
  major:       { label: 'Major',       color: '#f97316', bg: 'rgba(249,115,22,.12)' },
  minor:       { label: 'Minor',       color: '#fbbf24', bg: 'rgba(251,191,36,.12)' },
  maintenance: { label: 'Maintenance', color: '#8b5cf6', bg: 'rgba(139,92,246,.12)' },
}

const INC_STATUS = {
  investigating: { label: 'Investigating', color: '#ef4444' },
  identified:    { label: 'Identified',    color: '#f97316' },
  monitoring:    { label: 'Monitoring',    color: '#fbbf24' },
  resolved:      { label: 'Resolved',      color: '#22c55e' },
}

const MW_STATUS = {
  scheduled:   { label: 'Scheduled',   color: '#8b5cf6' },
  in_progress: { label: 'In Progress', color: '#f97316' },
  completed:   { label: 'Completed',   color: '#22c55e' },
  cancelled:   { label: 'Cancelled',   color: '#6b7280' },
}

const PERIODS = [
  { key: '24h', label: '24h', segments: 24, segMs: 60 * 60 * 1000 },
  { key: '7d',  label: '7d',  segments: 42, segMs: 4 * 60 * 60 * 1000 },
  { key: '30d', label: '30d', segments: 30, segMs: 24 * 60 * 60 * 1000 },
  { key: '90d', label: '90d', segments: 90, segMs: 24 * 60 * 60 * 1000 },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root:        { fontFamily: "'Inter', sans-serif", color: '#e2e8f0' },
  card:        { background: '#0c1018', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '18px 20px', marginBottom: 12 },
  section:     { marginBottom: 24 },
  sectionTitle:{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: .8 },
  divider:     { borderTop: '1px solid rgba(255,255,255,.05)', margin: '14px 0' },

  btn:      { background: 'rgba(37,99,235,.15)',  border: '1px solid rgba(37,99,235,.3)',  color: '#60a5fa', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  greenBtn: { background: 'rgba(34,197,94,.1)',   border: '1px solid rgba(34,197,94,.3)',  color: '#4ade80', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  redBtn:   { background: 'rgba(239,68,68,.1)',   border: '1px solid rgba(239,68,68,.3)',  color: '#f87171', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  purpleBtn:{ background: 'rgba(139,92,246,.1)',  border: '1px solid rgba(139,92,246,.3)', color: '#c4b5fd', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  ghostBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: '#64748b', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer' },
  iconBtn:  { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18, padding: '0 4px', lineHeight: 1 },

  input:    { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 7, color: '#e8e8e8', padding: '8px 11px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' },
  select:   { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 7, color: '#e8e8e8', padding: '8px 11px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' },
  textarea: { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 7, color: '#e8e8e8', padding: '8px 11px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif', resize: 'vertical', minHeight: 80 },
  label:    { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: .6, textTransform: 'uppercase' },
  fGroup:   { marginBottom: 14 },

  badge: (c) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${c}22`, color: c, border: `1px solid ${c}44` }),

  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalBox:   { background: '#0f1521', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '28px 26px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 },

  banner: (color) => ({ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }),

  uptimeBarWrap: { height: 28, display: 'flex', gap: 2, borderRadius: 6, overflow: 'hidden', cursor: 'crosshair' },
  popover:       { position: 'fixed', zIndex: 9998, background: '#1a2236', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#cdd6f4', boxShadow: '0 8px 32px rgba(0,0,0,.5)', pointerEvents: 'none', minWidth: 190 },

  tab: (active) => ({ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'rgba(59,130,246,.15)' : 'transparent', color: active ? '#60a5fa' : '#64748b', transition: 'all .15s' }),

  timeline:      { paddingLeft: 20, borderLeft: '2px solid rgba(255,255,255,.08)', marginTop: 12 },
  timelineEntry: { position: 'relative', paddingLeft: 16, marginBottom: 14 },
  timelineDot:   (c) => ({ position: 'absolute', left: -21, top: 4, width: 8, height: 8, borderRadius: '50%', background: c, border: '2px solid #0f1521' }),

  codeBlock: { background: '#050a0f', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#7dd3fc', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.7 },

  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' },
  rowLabel: { fontSize: 13, color: '#94a3b8' },
  rowValue: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ago(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

function overallStatus(incidents) {
  const active = (incidents || []).filter(i => i.status !== 'resolved')
  if (!active.length) return { label: 'All Systems Operational', color: '#22c55e', icon: '✓' }
  const sev = active.map(i => i.severity)
  if (sev.includes('critical')) return { label: 'Major Outage Detected', color: '#ef4444', icon: '✗' }
  if (sev.includes('major'))    return { label: 'Partial Outage', color: '#f97316', icon: '!' }
  return { label: 'Minor Disruption', color: '#fbbf24', icon: '~' }
}

function buildSegments(healthChecks, incidents, period) {
  const now = Date.now()
  const totalMs = period.segments * period.segMs
  const start   = now - totalMs
  const segs    = []

  for (let i = 0; i < period.segments; i++) {
    const segStart = start + i * period.segMs
    const segEnd   = segStart + period.segMs

    const checks = (healthChecks || []).filter(h => {
      const t = new Date(h.checked_at).getTime()
      return t >= segStart && t < segEnd
    })

    const inc = (incidents || []).filter(inc => {
      const s = new Date(inc.started_at).getTime()
      const e = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now
      return s < segEnd && e > segStart
    })

    let status = 'unknown'
    let color  = 'rgba(255,255,255,.06)'

    if (checks.length > 0) {
      const statuses = checks.map(c => c.status)
      if (statuses.some(s => s === 'down'))     { status = 'down';     color = '#ef4444' }
      else if (statuses.some(s => s === 'degraded')) { status = 'degraded'; color = '#fbbf24' }
      else                                      { status = 'up';       color = '#22c55e' }
    } else if (inc.length > 0) {
      const sev = inc.map(x => x.severity)
      if (sev.includes('critical') || sev.includes('major')) { status = 'down';        color = '#ef4444' }
      else if (sev.includes('minor'))                        { status = 'degraded';    color = '#fbbf24' }
      else                                                   { status = 'maintenance'; color = '#8b5cf6' }
    } else if (segEnd < now - 5 * 60 * 1000) {
      status = 'no-data'; color = 'rgba(255,255,255,.06)'
    } else {
      status = 'up'; color = '#22c55e'
    }

    segs.push({ i, segStart, segEnd, status, color, checks, inc })
  }
  return segs
}

function uptimePct(segs) {
  const known = segs.filter(s => s.status !== 'unknown' && s.status !== 'no-data')
  if (!known.length) return '100.00'
  const up = known.filter(s => s.status === 'up').length
  return ((up / known.length) * 100).toFixed(2)
}

function exportCSV(incidents) {
  const rows = [
    ['Title', 'Severity', 'Status', 'Started', 'Resolved', 'Duration (min)'],
    ...(incidents || []).map(i => [
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.severity, i.status, i.started_at, i.resolved_at || '',
      i.resolved_at ? Math.round((new Date(i.resolved_at) - new Date(i.started_at)) / 60000) : '',
    ]),
  ]
  const csv  = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── UptimeBar ─────────────────────────────────────────────────────────────────

function UptimeBar({ segs }) {
  const [hover, setHover] = useState(null)
  const [pos,   setPos]   = useState({ x: 0, y: 0 })

  return (
    <div style={{ position: 'relative' }}>
      <div style={S.uptimeBarWrap}>
        {segs.map((seg, i) => (
          <div
            key={i}
            style={{ flex: 1, background: seg.color, opacity: hover === i ? 0.65 : 1, transition: 'opacity .1s', cursor: 'crosshair' }}
            onMouseEnter={e => { setHover(i); setPos({ x: e.clientX, y: e.clientY }) }}
            onMouseMove={e => setPos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </div>

      {hover !== null && segs[hover] && (
        <div style={{
          ...S.popover,
          left: Math.min(pos.x + 14, window.innerWidth - 215),
          top:  Math.max(pos.y - 90, 8),
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#fff', fontSize: 11 }}>
            {fmt(segs[hover].segStart)}
          </div>
          <div style={{ color: segs[hover].color, fontWeight: 600, marginBottom: 3 }}>
            {segs[hover].status === 'up'          ? '✓ Operational' :
             segs[hover].status === 'degraded'    ? '~ Degraded'    :
             segs[hover].status === 'down'        ? '✗ Outage'      :
             segs[hover].status === 'maintenance' ? '⚙ Maintenance' : 'No data'}
          </div>
          {segs[hover].checks.length > 0 && (
            <div style={{ color: '#64748b', fontSize: 11 }}>
              {segs[hover].checks.length} check{segs[hover].checks.length !== 1 ? 's' : ''}
              {segs[hover].checks.some(c => c.latency_ms) && (
                ` · avg ${Math.round(segs[hover].checks.reduce((s, c) => s + (c.latency_ms || 0), 0) / segs[hover].checks.filter(c => c.latency_ms).length)}ms`
              )}
            </div>
          )}
          {segs[hover].inc.length > 0 && (
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
              {segs[hover].inc.map(x => x.title).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ServiceUptimeCard ─────────────────────────────────────────────────────────

function ServiceUptimeCard({ service, healthChecks, incidents, period }) {
  const svcChecks = (healthChecks || []).filter(h => h.service_id === service.id)
  const svcInc    = (incidents    || []).filter(i => (i._services || []).includes(service.id))
  const segs      = buildSegments(svcChecks, svcInc, period)
  const pct       = uptimePct(segs)
  const pctNum    = parseFloat(pct)
  const pctColor  = pctNum >= 99.9 ? '#22c55e' : pctNum >= 99 ? '#fbbf24' : '#ef4444'
  const latest    = [...svcChecks].sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))[0]
  const curStatus = latest?.status || (svcInc.some(i => i.status !== 'resolved') ? 'down' : 'up')
  const dotColor  = curStatus === 'up' ? '#22c55e' : curStatus === 'degraded' ? '#fbbf24' : '#ef4444'

  return (
    <div style={{ ...S.card, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}88`, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{service.name}</span>
          {service.category && <span style={{ fontSize: 11, color: '#334155', background: 'rgba(255,255,255,.04)', padding: '1px 6px', borderRadius: 8 }}>{service.category}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {latest?.latency_ms && <span style={{ fontSize: 11, color: '#475569' }}>{latest.latency_ms}ms</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: pctColor }}>{pct}%</span>
        </div>
      </div>
      <UptimeBar segs={segs} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 10, color: '#1e293b' }}>{period.label} ago</span>
        {latest && <span style={{ fontSize: 10, color: '#1e293b' }}>checked {ago(latest.checked_at)}</span>}
        <span style={{ fontSize: 10, color: '#1e293b' }}>now</span>
      </div>
    </div>
  )
}

// ── StatusBanner ──────────────────────────────────────────────────────────────

function StatusBanner({ incidents, loading }) {
  if (loading) return null
  const { label, color, icon } = overallStatus(incidents)
  return (
    <div style={S.banner(color)}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{icon} {label}</span>
      <span style={{ fontSize: 11, color: '#334155', marginLeft: 'auto' }}>
        Updated {new Date().toLocaleTimeString()}
      </span>
    </div>
  )
}

// ── IncidentTimeline ──────────────────────────────────────────────────────────

function IncidentTimeline({ updates }) {
  const sorted = [...(updates || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  if (!sorted.length) return <div style={{ fontSize: 12, color: '#334155', paddingLeft: 8 }}>No updates posted yet.</div>
  return (
    <div style={S.timeline}>
      {sorted.map((u, i) => {
        const sc = INC_STATUS[u.status]?.color || '#64748b'
        return (
          <div key={u.id || i} style={S.timelineEntry}>
            <div style={S.timelineDot(sc)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={S.badge(sc)}>{INC_STATUS[u.status]?.label || u.status}</span>
              <span style={{ fontSize: 11, color: '#475569' }}>{fmt(u.created_at)}</span>
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>{u.message}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── IncidentCard ──────────────────────────────────────────────────────────────

function IncidentCard({ incident, updates, services, onEdit, onAddUpdate, onResolve }) {
  const [expanded, setExpanded] = useState(false)
  const sev  = SEVERITY[incident.severity]   || SEVERITY.minor
  const stat = INC_STATUS[incident.status]   || INC_STATUS.investigating
  const affectedNames = (incident._services || [])
    .map(sid => (services || []).find(s => s.id === sid)?.name)
    .filter(Boolean)
  const resolved = incident.status === 'resolved'
  const durationMin = incident.resolved_at
    ? Math.round((new Date(incident.resolved_at) - new Date(incident.started_at)) / 60000)
    : null

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${sev.color}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={S.badge(sev.color)}>{sev.label}</span>
            <span style={S.badge(stat.color)}>{stat.label}</span>
            {affectedNames.map(n => (
              <span key={n} style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,.04)', padding: '1px 8px', borderRadius: 10 }}>{n}</span>
            ))}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{incident.title}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Started {fmt(incident.started_at)}
            {resolved
              ? ` · Resolved ${fmt(incident.resolved_at)}${durationMin !== null ? ` · ${durationMin < 60 ? `${durationMin}m` : `${(durationMin/60).toFixed(1)}h`}` : ''}`
              : ' · Ongoing'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!resolved && (
            <>
              <button style={{ ...S.ghostBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => onAddUpdate(incident)}>+ Update</button>
              <button style={{ ...S.greenBtn,  fontSize: 11, padding: '4px 8px' }} onClick={() => onResolve(incident)}>Resolve</button>
            </>
          )}
          <button style={{ ...S.btn, fontSize: 11, padding: '4px 8px' }} onClick={() => onEdit(incident)}>Edit</button>
          <button style={{ ...S.ghostBtn, fontSize: 11, padding: '4px 8px' }} onClick={() => setExpanded(e => !e)}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {incident.description && (
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.55, paddingLeft: 4 }}>
              {incident.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>
            Timeline
          </div>
          <IncidentTimeline updates={updates} />
        </div>
      )}
    </div>
  )
}

// ── IncidentModal ─────────────────────────────────────────────────────────────

function IncidentModal({ incident, services, mode, onClose, onSaved }) {
  const isUpdate = mode === 'update'
  const isEdit   = mode === 'edit'
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  const [form, setForm] = useState(() => isUpdate ? {
    status:  incident?.status || 'investigating',
    message: '',
  } : {
    title:       incident?.title       || '',
    severity:    incident?.severity    || 'minor',
    status:      incident?.status      || 'investigating',
    description: incident?.description || '',
    started_at:  incident?.started_at
      ? new Date(incident.started_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    service_ids: incident?._services   || [],
    message:     '',
  })

  const set          = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleSvc    = (id) => setForm(f => ({
    ...f,
    service_ids: f.service_ids.includes(id)
      ? f.service_ids.filter(x => x !== id)
      : [...f.service_ids, id],
  }))

  const save = async () => {
    setErr(null)
    if (isUpdate && !form.message.trim()) { setErr('Update message is required.'); return }
    if (!isUpdate && !form.title.trim())  { setErr('Title is required.'); return }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      if (isUpdate) {
        await adminInsert('incident_updates', {
          incident_id: incident.id, status: form.status,
          message: form.message.trim(), created_at: now,
        })
        await adminUpdate('incidents', { status: form.status, updated_at: now }, `id=eq.${incident.id}`)
      } else if (isEdit && incident?.id) {
        const payload = {
          title: form.title.trim(), severity: form.severity, status: form.status,
          description: form.description.trim(),
          started_at: new Date(form.started_at).toISOString(),
          updated_at: now,
        }
        await adminUpdate('incidents', payload, `id=eq.${incident.id}`)
        await adminDelete('incident_services', `incident_id=eq.${incident.id}`)
        for (const sid of form.service_ids) {
          await adminInsert('incident_services', { incident_id: incident.id, service_id: sid })
        }
        if (form.message.trim()) {
          await adminInsert('incident_updates', {
            incident_id: incident.id, status: form.status,
            message: form.message.trim(), created_at: now,
          })
        }
      } else {
        const res = await adminInsert('incidents', {
          title: form.title.trim(), severity: form.severity, status: form.status,
          description: form.description.trim(),
          started_at: new Date(form.started_at).toISOString(),
          created_at: now, updated_at: now,
        })
        const incId = Array.isArray(res) ? res[0]?.id : res?.id
        if (incId) {
          for (const sid of form.service_ids) {
            await adminInsert('incident_services', { incident_id: incId, service_id: sid })
          }
          if (form.message.trim()) {
            await adminInsert('incident_updates', {
              incident_id: incId, status: form.status,
              message: form.message.trim(), created_at: now,
            })
          }
        }
      }
      onSaved()
      onClose()
    } catch (e) {
      console.error('IncidentModal save error:', e)
      setErr(e.message || 'Save failed. Check console.')
    }
    setSaving(false)
  }

  const title = isUpdate ? `Post Update — ${incident?.title || ''}`
              : isEdit   ? 'Edit Incident'
              :            'New Incident'

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={S.modalTitle}>{title}</div>
          <button style={S.iconBtn} onClick={onClose}>×</button>
        </div>

        {err && <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>}

        {!isUpdate && (
          <>
            <div style={S.fGroup}>
              <label style={S.label}>Title *</label>
              <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. API response times elevated" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={S.label}>Severity</label>
                <select style={S.select} value={form.severity} onChange={e => set('severity', e.target.value)}>
                  {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Started At</label>
                <input style={S.input} type="datetime-local" value={form.started_at} onChange={e => set('started_at', e.target.value)} />
              </div>
            </div>
            <div style={S.fGroup}>
              <label style={S.label}>Description</label>
              <textarea style={S.textarea} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What is happening? What is affected?" />
            </div>
            <div style={S.fGroup}>
              <label style={S.label}>Affected Services</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(services || []).filter(s => s.is_active).map(s => (
                  <div key={s.id} onClick={() => toggleSvc(s.id)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    background: form.service_ids.includes(s.id) ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.04)',
                    color:  form.service_ids.includes(s.id) ? '#f87171'  : '#64748b',
                    border: `1px solid ${form.service_ids.includes(s.id) ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.08)'}`,
                    transition: 'all .15s',
                  }}>
                    {form.service_ids.includes(s.id) ? '✓ ' : ''}{s.name}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={S.fGroup}>
          <label style={S.label}>Status</label>
          <select style={S.select} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(INC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div style={S.fGroup}>
          <label style={S.label}>{isUpdate ? 'Update Message *' : 'Initial Update (optional)'}</label>
          <textarea style={S.textarea} value={form.message} onChange={e => set('message', e.target.value)} placeholder="What's the current status? What steps are being taken?" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...S.ghostBtn, flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            style={{ ...S.greenBtn, flex: 2 }}
            onClick={save}
            disabled={saving}
          >
            {saving ? '⏳ Saving…' : isUpdate ? 'Post Update' : isEdit ? 'Save Changes' : 'Create Incident'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MaintenanceModal ──────────────────────────────────────────────────────────

function MaintenanceModal({ mw, services, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)
  const toLocal = (d) => d ? new Date(d).toISOString().slice(0, 16) : new Date(Date.now() + 3600000).toISOString().slice(0, 16)

  const [form, setForm] = useState({
    title:           mw?.title           || '',
    description:     mw?.description     || '',
    scheduled_start: toLocal(mw?.scheduled_start),
    scheduled_end:   toLocal(mw?.scheduled_end || Date.now() + 7200000),
    status:          mw?.status          || 'scheduled',
    service_ids:     mw?._services       || [],
  })

  const set       = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleSvc = (id)   => setForm(f => ({
    ...f,
    service_ids: f.service_ids.includes(id)
      ? f.service_ids.filter(x => x !== id)
      : [...f.service_ids, id],
  }))

  const save = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return }
    setSaving(true); setErr(null)
    try {
      const now = new Date().toISOString()
      const payload = {
        title:           form.title.trim(),
        description:     form.description.trim(),
        scheduled_start: new Date(form.scheduled_start).toISOString(),
        scheduled_end:   new Date(form.scheduled_end).toISOString(),
        status:          form.status,
        updated_at:      now,
      }
      let mwId = mw?.id
      if (mwId) {
        await adminUpdate('maintenance_windows', payload, `id=eq.${mwId}`)
        await adminDelete('maintenance_services', `maintenance_id=eq.${mwId}`)
      } else {
        const res = await adminInsert('maintenance_windows', { ...payload, created_at: now })
        mwId = Array.isArray(res) ? res[0]?.id : res?.id
      }
      if (mwId) {
        for (const sid of form.service_ids) {
          await adminInsert('maintenance_services', { maintenance_id: mwId, service_id: sid })
        }
      }
      onSaved(); onClose()
    } catch (e) {
      console.error('MaintenanceModal save error:', e)
      setErr(e.message || 'Save failed.')
    }
    setSaving(false)
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={S.modalTitle}>{mw ? 'Edit Maintenance Window' : 'New Maintenance Window'}</div>
          <button style={S.iconBtn} onClick={onClose}>×</button>
        </div>
        {err && <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>}
        <div style={S.fGroup}>
          <label style={S.label}>Title *</label>
          <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Database migration v2" />
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Description</label>
          <textarea style={S.textarea} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What work is being performed? Expected impact?" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Start</label>
            <input style={S.input} type="datetime-local" value={form.scheduled_start} onChange={e => set('scheduled_start', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>End</label>
            <input style={S.input} type="datetime-local" value={form.scheduled_end} onChange={e => set('scheduled_end', e.target.value)} />
          </div>
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Status</label>
          <select style={S.select} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(MW_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Affected Services</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(services || []).filter(s => s.is_active).map(s => (
              <div key={s.id} onClick={() => toggleSvc(s.id)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: form.service_ids.includes(s.id) ? 'rgba(139,92,246,.15)' : 'rgba(255,255,255,.04)',
                color:  form.service_ids.includes(s.id) ? '#c4b5fd' : '#64748b',
                border: `1px solid ${form.service_ids.includes(s.id) ? 'rgba(139,92,246,.3)' : 'rgba(255,255,255,.08)'}`,
              }}>
                {form.service_ids.includes(s.id) ? '✓ ' : ''}{s.name}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...S.ghostBtn, flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...S.purpleBtn, flex: 2 }} onClick={save} disabled={saving || !form.title}>
            {saving ? '⏳ Saving…' : mw ? 'Save Changes' : 'Create Window'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MonitoringPanel ───────────────────────────────────────────────────────────

function MonitoringPanel({ services, onCheckComplete }) {
  const [running,     setRunning]     = useState(false)
  const [results,     setResults]     = useState([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRun,     setLastRun]     = useState(null)
  const intervalRef = useRef(null)

  const runChecks = useCallback(async () => {
    setRunning(true)
    const now = new Date().toISOString()
    const res = []

    const check = async (name, slugHint, fn) => {
      const t0 = Date.now()
      try {
        const { ok, error, message } = await fn()
        const lat    = Date.now() - t0
        const status = !ok ? 'down' : lat > 500 ? 'degraded' : 'up'
        res.push({ name, status, latency_ms: lat, message: message || error?.message || null })
        const svc = (services || []).find(s =>
          s.slug === slugHint || s.name?.toLowerCase().includes(slugHint.toLowerCase())
        )
        if (svc) {
          await adminInsert('health_checks', {
            service_id: svc.id, checked_at: now, status, latency_ms: lat,
            message: message || error?.message || null,
          }).catch(() => {})
        }
      } catch (e) {
        const lat = Date.now() - t0
        res.push({ name, status: 'down', latency_ms: lat, message: e.message })
      }
    }

    await check('Database', 'database', async () => {
      const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true })
      return { ok: !error, error }
    })

    await check('Authentication', 'authentication', async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      return { ok: !!user && !error, error }
    })

    await check('Storage', 'storage', async () => {
      const { error } = await supabase.storage.listBuckets()
      return { ok: !error, error }
    })

    setResults(res)
    setLastRun(new Date())
    setRunning(false)
    if (onCheckComplete) onCheckComplete()
  }, [services, onCheckComplete])

  useEffect(() => {
    if (autoRefresh) {
      runChecks()
      intervalRef.current = setInterval(runChecks, 60000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, runChecks])

  return (
    <div>
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>🔍 Live Health Checks</div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              Runs DB, Auth, and Storage checks and logs results to <code style={{ color: '#60a5fa' }}>health_checks</code> table.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto (60s)
            </label>
            <button style={S.btn} onClick={runChecks} disabled={running}>
              {running ? '⟳ Checking…' : '↻ Run Checks'}
            </button>
          </div>
        </div>

        {lastRun && <div style={{ fontSize: 11, color: '#334155', marginBottom: 12 }}>Last run: {lastRun.toLocaleTimeString()}</div>}

        {results.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
            {results.map(r => {
              const color = r.status === 'up' ? '#22c55e' : r.status === 'degraded' ? '#fbbf24' : '#ef4444'
              return (
                <div key={r.name} style={{ ...S.card, marginBottom: 0, borderTop: `3px solid ${color}`, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}88` }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{r.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color }}>{r.status === 'up' ? 'Operational' : r.status === 'degraded' ? 'Degraded' : 'Down'}</div>
                  {r.latency_ms !== null && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{r.latency_ms}ms</div>}
                  {r.message && <div style={{ fontSize: 11, color: '#f87171', marginTop: 3, wordBreak: 'break-word' }}>{r.message}</div>}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#334155', textAlign: 'center', padding: '24px 0' }}>
            Click <strong style={{ color: '#64748b' }}>Run Checks</strong> to test all services.
          </div>
        )}
      </div>

      <div style={{ ...S.card, marginTop: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>📐 Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'DB Latency Warning',  value: '> 200ms', color: '#fbbf24' },
            { label: 'DB Latency Critical', value: '> 500ms', color: '#ef4444' },
            { label: 'Check Interval',      value: '60s (auto)', color: '#60a5fa' },
          ].map(item => (
            <div key={item.label} style={{ ...S.card, marginBottom: 0, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#334155', marginTop: 12 }}>
          💡 To add custom services or adjust thresholds, edit the <code style={{ color: '#60a5fa' }}>services</code> table in Supabase.
        </div>
      </div>
    </div>
  )
}

// ── PublicWidgetPanel ─────────────────────────────────────────────────────────

function PublicWidgetPanel({ config, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [form, setForm] = useState({
    page_title:       config?.page_title       || 'KrakenCam Status',
    page_description: config?.page_description || 'Real-time system status and incident history.',
    theme:            config?.theme            || 'dark',
    show_uptime:      config?.show_uptime      ?? true,
    show_incidents:   config?.show_incidents   ?? true,
    show_maintenance: config?.show_maintenance ?? true,
    is_public:        config?.is_public        ?? false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const origin = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://app.krakencam.com'

  const scriptEmbed = `<!-- KrakenCam Status Widget -->\n<script\n  src="${origin}/status-widget.js"\n  data-theme="${form.theme}"\n  data-show-uptime="${form.show_uptime}"\n></script>\n<div id="krakencam-status"></div>`

  const iframeEmbed = `<iframe\n  src="${origin}/status"\n  width="100%"\n  height="420"\n  frameborder="0"\n  style="border-radius:12px;border:none"\n  title="${form.page_title}"\n></iframe>`

  const save = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      if (config?.id) {
        await adminUpdate('public_status_config', { ...form, updated_at: now }, `id=eq.${config.id}`)
      } else {
        await adminInsert('public_status_config', { ...form, created_at: now, updated_at: now })
      }
      onSaved()
    } catch (e) {
      console.error('PublicWidgetPanel save:', e)
    }
    setSaving(false)
  }

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  return (
    <div>
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>🌐 Public Status Page Config</div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
          Configure what is shown on the public-facing status page and embed widgets.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Page Title</label>
            <input style={S.input} value={form.page_title} onChange={e => set('page_title', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Theme</label>
            <select style={S.select} value={form.theme} onChange={e => set('theme', e.target.value)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto (system preference)</option>
            </select>
          </div>
        </div>
        <div style={S.fGroup}>
          <label style={S.label}>Page Description</label>
          <input style={S.input} value={form.page_description} onChange={e => set('page_description', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
          {[
            ['show_uptime',      'Show Uptime Bars'],
            ['show_incidents',   'Show Incidents'],
            ['show_maintenance', 'Show Maintenance'],
            ['is_public',        '🌐 Enable Public Page'],
          ].map(([k, lbl]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: k === 'is_public' ? '#4ade80' : '#94a3b8', cursor: 'pointer' }}>
              <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} />
              {lbl}
            </label>
          ))}
        </div>

        {!form.is_public && (
          <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#fbbf24', marginBottom: 14 }}>
            ⚠️ Public page is currently <strong>disabled</strong>. Check "Enable Public Page" to make the status page accessible.
          </div>
        )}

        <button style={S.greenBtn} onClick={save} disabled={saving}>
          {saving ? '⏳ Saving…' : '✓ Save Config'}
        </button>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>📋 Embed Codes</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Script Tag Embed</div>
          <div style={S.codeBlock}>{scriptEmbed}</div>
          <button style={{ ...S.ghostBtn, marginTop: 8, fontSize: 11 }} onClick={() => copy(scriptEmbed, 'script')}>
            {copied === 'script' ? '✓ Copied!' : '📋 Copy Code'}
          </button>
        </div>

        <div style={S.divider} />

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>iFrame Embed</div>
          <div style={S.codeBlock}>{iframeEmbed}</div>
          <button style={{ ...S.ghostBtn, marginTop: 8, fontSize: 11 }} onClick={() => copy(iframeEmbed, 'iframe')}>
            {copied === 'iframe' ? '✓ Copied!' : '📋 Copy Code'}
          </button>
        </div>

        <div style={{ ...S.divider }} />
        <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
          💡 The public status page lives at <code style={{ color: '#60a5fa' }}>/status</code>.
          Only published incidents and scheduled maintenance are shown publicly.
          The embed widget only uses anon-readable data — no admin credentials are exposed.
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminHealth() {
  const [tab,          setTab]          = useState('status')
  const [period,       setPeriod]       = useState(PERIODS[0])
  const [services,     setServices]     = useState([])
  const [healthChecks, setHealthChecks] = useState([])
  const [incidents,    setIncidents]    = useState([])
  const [incUpdates,   setIncUpdates]   = useState([])
  const [maintenance,  setMaintenance]  = useState([])
  const [widgetConfig, setWidgetConfig] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [tableCounts,  setTableCounts]  = useState({})
  const [dbOk,         setDbOk]         = useState(null)
  const [dbLatency,    setDbLatency]    = useState(null)
  const [authOk,       setAuthOk]       = useState(null)
  const [storageOk,    setStorageOk]    = useState(null)
  const [storageInfo,  setStorageInfo]  = useState(null)

  // Modal state
  const [showIncModal, setShowIncModal] = useState(false)
  const [showMwModal,  setShowMwModal]  = useState(false)
  const [editInc,      setEditInc]      = useState(null)
  const [incMode,      setIncMode]      = useState('create')
  const [editMw,       setEditMw]       = useState(null)
  const [showResolved, setShowResolved] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    const periodMs = period.segments * period.segMs
    const since    = new Date(Date.now() - periodMs).toISOString()

    // Load uptime-related data
    const [svcs, hcs, incs, upds, mws, cfg] = await Promise.allSettled([
      adminFrom('services',            'select=*&order=display_order,name&is_active=eq.true'),
      adminFrom('health_checks',       `select=*&checked_at=gte.${since}&order=checked_at.asc`),
      adminFrom('incidents',           'select=*,incident_services(service_id)&order=started_at.desc&limit=100'),
      adminFrom('incident_updates',    'select=*&order=created_at.desc'),
      adminFrom('maintenance_windows', 'select=*,maintenance_services(service_id)&order=scheduled_start.desc&limit=50'),
      adminFrom('public_status_config','select=*&limit=1'),
    ])

    const svcList = svcs.status === 'fulfilled' && Array.isArray(svcs.value) ? svcs.value : []
    const hcList  = hcs.status  === 'fulfilled' && Array.isArray(hcs.value)  ? hcs.value  : []
    const incList = (incs.status === 'fulfilled' && Array.isArray(incs.value) ? incs.value : []).map(i => ({
      ...i,
      _services: (i.incident_services || []).map(s => s.service_id),
    }))
    const updList = upds.status === 'fulfilled' && Array.isArray(upds.value)  ? upds.value : []
    const mwList  = (mws.status  === 'fulfilled' && Array.isArray(mws.value)  ? mws.value  : []).map(m => ({
      ...m,
      _services: (m.maintenance_services || []).map(s => s.service_id),
    }))
    const cfgItem = cfg.status === 'fulfilled' && Array.isArray(cfg.value) && cfg.value.length ? cfg.value[0] : null

    setServices(svcList)
    setHealthChecks(hcList)
    setIncidents(incList)
    setIncUpdates(updList)
    setMaintenance(mwList)
    setWidgetConfig(cfgItem)

    // Live connectivity checks
    const t0 = Date.now()
    try {
      const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true })
      setDbOk(!error)
      setDbLatency(Date.now() - t0)
    } catch { setDbOk(false); setDbLatency(null) }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      setAuthOk(!!user)
    } catch { setAuthOk(false) }

    try {
      const { data, error } = await supabase.storage.listBuckets()
      setStorageOk(!error)
      setStorageInfo(data ? { buckets: data.length } : null)
    } catch { setStorageOk(false) }

    // Table row counts
    const counts = {}
    await Promise.allSettled(TABLE_CHECKS.map(async ({ table }) => {
      try {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
        counts[table] = error ? '—' : count?.toLocaleString() ?? '0'
      } catch { counts[table] = '—' }
    }))
    setTableCounts(counts)
    setLoading(false)
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  // Incident actions
  const openCreate  = ()    => { setEditInc(null); setIncMode('create'); setShowIncModal(true) }
  const openEdit    = (inc) => { setEditInc(inc);  setIncMode('edit');   setShowIncModal(true) }
  const openUpdate  = (inc) => { setEditInc(inc);  setIncMode('update'); setShowIncModal(true) }
  const resolveInc  = async (inc) => {
    const now = new Date().toISOString()
    await adminUpdate('incidents', { status: 'resolved', resolved_at: now, updated_at: now }, `id=eq.${inc.id}`)
    await adminInsert('incident_updates', { incident_id: inc.id, status: 'resolved', message: 'This incident has been resolved.', created_at: now })
    loadData()
  }

  const activeInc  = incidents.filter(i => i.status !== 'resolved')
  const resolvedInc= incidents.filter(i => i.status === 'resolved')
  const upcomingMw = maintenance.filter(m => m.status === 'scheduled' || m.status === 'in_progress')
  const pastMw     = maintenance.filter(m => m.status === 'completed' || m.status === 'cancelled')

  const TABS = [
    { key: 'status',      label: '📊 Status' },
    { key: 'incidents',   label: '🚨 Incidents',   count: activeInc.length },
    { key: 'maintenance', label: '⚙️ Maintenance', count: upcomingMw.length },
    { key: 'monitoring',  label: '🔍 Monitoring' },
    { key: 'widget',      label: '🌐 Widget' },
  ]

  return (
    <div style={S.root}>
      {/* Overall status banner */}
      <StatusBanner incidents={incidents} loading={loading} />

      {/* Tab bar + period + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} style={S.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 5, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>{t.count}</span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {tab === 'status' && PERIODS.map(p => (
            <button
              key={p.key}
              style={{
                ...S.ghostBtn, padding: '4px 10px', fontSize: 11,
                color:      period.key === p.key ? '#60a5fa' : '#475569',
                background: period.key === p.key ? 'rgba(59,130,246,.1)' : 'transparent',
                border:     `1px solid ${period.key === p.key ? 'rgba(59,130,246,.3)' : 'rgba(255,255,255,.07)'}`,
              }}
              onClick={() => setPeriod(p)}
            >{p.label}</button>
          ))}
          <button style={{ ...S.ghostBtn, padding: '5px 10px', fontSize: 13 }} onClick={loadData} title="Refresh">↻</button>
        </div>
      </div>

      {/* ══ STATUS TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'status' && (
        <>
          {/* Quick stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Active Incidents',      value: activeInc.length,  color: activeInc.length  ? '#ef4444' : '#22c55e' },
              { label: 'Services Monitored',    value: services.length,   color: '#60a5fa'  },
              { label: 'DB Latency',            value: dbLatency != null ? `${dbLatency}ms` : '—', color: dbLatency != null ? (dbLatency < 200 ? '#22c55e' : dbLatency < 500 ? '#fbbf24' : '#ef4444') : '#64748b' },
              { label: 'Scheduled Maintenance', value: upcomingMw.length, color: upcomingMw.length ? '#8b5cf6' : '#22c55e' },
            ].map(item => (
              <div key={item.label} style={{ ...S.card, marginBottom: 0, textAlign: 'center', padding: '16px 14px' }}>
                <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: item.color, lineHeight: 1 }}>
                  {loading ? '…' : item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Service uptime bars */}
          <div style={S.section}>
            <div style={S.sectionTitle}>📈 Service Uptime — {period.label}</div>
            {loading ? (
              <div style={{ color: '#334155', fontSize: 13, padding: '12px 0' }}>Loading services…</div>
            ) : services.length === 0 ? (
              <div style={{ color: '#475569', fontSize: 13, padding: '12px 0' }}>
                No active services found. Services are seeded in the <code style={{ color: '#60a5fa' }}>services</code> table.
              </div>
            ) : (
              services.map(svc => (
                <ServiceUptimeCard
                  key={svc.id}
                  service={svc}
                  healthChecks={healthChecks}
                  incidents={incidents}
                  period={period}
                />
              ))
            )}
          </div>

          {/* Current status cards */}
          <div style={{ ...S.card }}>
            <div style={S.sectionTitle}>🖥️ Live Connectivity</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Database',       ok: dbOk,      detail: dbLatency != null ? `${dbLatency}ms query` : null },
                { label: 'Authentication', ok: authOk,    detail: 'Supabase Auth' },
                { label: 'Storage',        ok: storageOk, detail: storageInfo ? `${storageInfo.buckets} bucket${storageInfo.buckets !== 1 ? 's' : ''}` : null },
              ].map(svc => {
                const c = loading ? '#3b82f6' : svc.ok ? '#22c55e' : '#ef4444'
                return (
                  <div key={svc.label} style={{ ...S.card, marginBottom: 0, borderTop: `3px solid ${c}`, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}88` }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{svc.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: c }}>
                      {loading ? 'Checking…' : svc.ok ? '✓ Operational' : '✗ Error'}
                    </div>
                    {svc.detail && !loading && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{svc.detail}</div>}
                  </div>
                )
              })}
            </div>

            {/* DB latency bar */}
            {dbLatency != null && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginBottom: 4 }}>
                  <span>DB query latency</span>
                  <span style={{ color: dbLatency < 200 ? '#22c55e' : dbLatency < 500 ? '#fbbf24' : '#ef4444' }}>{dbLatency}ms</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (dbLatency / 1000) * 100)}%`,
                    background: dbLatency < 200 ? '#22c55e' : dbLatency < 500 ? '#fbbf24' : '#ef4444',
                    borderRadius: 3, transition: 'width .4s',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>Target: &lt;200ms</div>
              </div>
            )}

            <div style={S.divider} />

            {/* Table counts */}
            <div style={S.sectionTitle}>🗄️ Data Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {TABLE_CHECKS.map(({ table, label }) => (
                <div key={table} style={S.row}>
                  <span style={S.rowLabel}>{label}</span>
                  <span style={S.rowValue}>{loading ? '…' : (tableCounts[table] || '—')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active incidents on status tab */}
          {activeInc.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionTitle}>🚨 Active Incidents</div>
              {activeInc.map(inc => (
                <IncidentCard
                  key={inc.id} incident={inc}
                  updates={incUpdates.filter(u => u.incident_id === inc.id)}
                  services={services}
                  onEdit={openEdit} onAddUpdate={openUpdate} onResolve={resolveInc}
                />
              ))}
            </div>
          )}

          {/* Upcoming maintenance on status tab */}
          {upcomingMw.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionTitle}>⚙️ Scheduled Maintenance</div>
              {upcomingMw.map(mw => {
                const sc = MW_STATUS[mw.status] || MW_STATUS.scheduled
                const affNames = (mw._services || []).map(sid => services.find(s => s.id === sid)?.name).filter(Boolean)
                return (
                  <div key={mw.id} style={{ ...S.card, borderLeft: `3px solid ${sc.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={S.badge(sc.color)}>{sc.label}</span>
                      {affNames.map(n => <span key={n} style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,.04)', padding: '1px 7px', borderRadius: 10 }}>{n}</span>)}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{mw.title}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{fmtDate(mw.scheduled_start)} — {fmtDate(mw.scheduled_end)}</div>
                    {mw.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{mw.description}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══ INCIDENTS TAB ════════════════════════════════════════════════════ */}
      {tab === 'incidents' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              <span style={{ color: activeInc.length ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{activeInc.length} active</span>
              {' '}· {resolvedInc.length} resolved
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.ghostBtn} onClick={() => exportCSV(incidents)}>⬇ Export CSV</button>
              <button style={S.redBtn}   onClick={openCreate}>+ New Incident</button>
            </div>
          </div>

          {activeInc.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', color: '#22c55e', fontSize: 14, fontWeight: 600, padding: 28 }}>
              ✓ No active incidents — all systems operating normally.
            </div>
          )}

          {activeInc.map(inc => (
            <IncidentCard key={inc.id} incident={inc}
              updates={incUpdates.filter(u => u.incident_id === inc.id)}
              services={services} onEdit={openEdit} onAddUpdate={openUpdate} onResolve={resolveInc}
            />
          ))}

          {resolvedInc.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button style={{ ...S.ghostBtn, marginBottom: 12 }} onClick={() => setShowResolved(s => !s)}>
                {showResolved ? '▲ Hide' : '▼ Show'} resolved ({resolvedInc.length})
              </button>
              {showResolved && resolvedInc.map(inc => (
                <IncidentCard key={inc.id} incident={inc}
                  updates={incUpdates.filter(u => u.incident_id === inc.id)}
                  services={services} onEdit={openEdit} onAddUpdate={openUpdate} onResolve={resolveInc}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ MAINTENANCE TAB ══════════════════════════════════════════════════ */}
      {tab === 'maintenance' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              {upcomingMw.length} upcoming · {pastMw.length} past
            </div>
            <button style={S.purpleBtn} onClick={() => { setEditMw(null); setShowMwModal(true) }}>
              + New Window
            </button>
          </div>

          {upcomingMw.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', color: '#64748b', fontSize: 13, padding: 28 }}>
              No upcoming maintenance windows scheduled.
            </div>
          )}

          {upcomingMw.map(mw => {
            const sc       = MW_STATUS[mw.status] || MW_STATUS.scheduled
            const affNames = (mw._services || []).map(sid => services.find(s => s.id === sid)?.name).filter(Boolean)
            return (
              <div key={mw.id} style={{ ...S.card, borderLeft: `3px solid ${sc.color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={S.badge(sc.color)}>{sc.label}</span>
                      {affNames.map(n => <span key={n} style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,.04)', padding: '1px 7px', borderRadius: 10 }}>{n}</span>)}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{mw.title}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      {fmtDate(mw.scheduled_start)} — {fmtDate(mw.scheduled_end)}
                    </div>
                    {mw.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>{mw.description}</div>}
                  </div>
                  <button style={{ ...S.btn, fontSize: 11, padding: '4px 8px', flexShrink: 0 }}
                    onClick={() => { setEditMw(mw); setShowMwModal(true) }}>Edit</button>
                </div>
              </div>
            )
          })}

          {pastMw.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button style={{ ...S.ghostBtn, marginBottom: 12 }} onClick={() => setShowResolved(s => !s)}>
                {showResolved ? '▲ Hide' : '▼ Show'} past ({pastMw.length})
              </button>
              {showResolved && pastMw.map(mw => {
                const sc = MW_STATUS[mw.status] || MW_STATUS.completed
                const affNames = (mw._services || []).map(sid => services.find(s => s.id === sid)?.name).filter(Boolean)
                return (
                  <div key={mw.id} style={{ ...S.card, borderLeft: `3px solid ${sc.color}`, opacity: .7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={S.badge(sc.color)}>{sc.label}</span>
                      {affNames.map(n => <span key={n} style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,.04)', padding: '1px 7px', borderRadius: 10 }}>{n}</span>)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{mw.title}</div>
                    <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>
                      {fmtDate(mw.scheduled_start)} — {fmtDate(mw.scheduled_end)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ MONITORING TAB ═══════════════════════════════════════════════════ */}
      {tab === 'monitoring' && (
        <MonitoringPanel services={services} onCheckComplete={loadData} />
      )}

      {/* ══ WIDGET TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'widget' && (
        <PublicWidgetPanel config={widgetConfig} onSaved={loadData} />
      )}

      {/* ══ MODALS ═══════════════════════════════════════════════════════════ */}
      {showIncModal && (
        <IncidentModal
          incident={editInc}
          services={services}
          mode={incMode}
          onClose={() => setShowIncModal(false)}
          onSaved={loadData}
        />
      )}
      {showMwModal && (
        <MaintenanceModal
          mw={editMw}
          services={services}
          onClose={() => setShowMwModal(false)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
