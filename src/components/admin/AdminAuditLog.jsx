/**
 * AdminAuditLog.jsx
 *
 * Displays audit log entries from the audit_log table.
 * Only accessible to super_admin users (RLS enforced).
 */

import React, { useState, useEffect, useCallback } from 'react'
import { adminFrom } from '../../lib/adminFetch'

const PAGE_SIZE = 20

const EVENT_COLORS = {
  'org.tier_changed':             '#8b5cf6',
  'org.suspended':                '#ef4444',
  'org.reactivated':              '#22c55e',
  'org.enterprise_pricing_set':   '#f59e0b',
  'discount_code.toggled':        '#3b82f6',
  'discount_code.deleted':        '#ef4444',
  'discount_code.created':        '#22c55e',
  'user.invited':                 '#06b6d4',
  'user.accepted_invite':         '#22c55e',
}

function eventColor(type) {
  return EVENT_COLORS[type] || '#6b7280'
}

function formatDetails(details) {
  if (!details || typeof details !== 'object') return '—'
  const entries = Object.entries(details)
  if (entries.length === 0) return '—'
  return entries
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ')
    .slice(0, 120)
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [eventFilter, setEventFilter] = useState('')
  const [eventTypes, setEventTypes] = useState([])

  const load = useCallback(async (pageNum, filter) => {
    setLoading(true)
    setError(null)

    const from = pageNum * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    try {
      // adminFrom uses the authenticated session JWT (not anon key) for RLS
      let params = `select=*&order=created_at.desc&offset=${from}&limit=${PAGE_SIZE + 1}`
      if (filter) params += `&event_type=eq.${encodeURIComponent(filter)}`
      const data = await adminFrom('audit_log', params)

      setEntries((data || []).slice(0, PAGE_SIZE))
      setHasMore((data || []).length > PAGE_SIZE)
      setLoading(false)

      // Collect unique event types for filter dropdown (from first page only)
      if (pageNum === 0 && !filter) {
        const types = [...new Set((data || []).map(e => e.event_type).filter(Boolean))]
      setEventTypes(types)
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(0, eventFilter)
    setPage(0)
  }, [eventFilter, load])

  function handlePrev() {
    const prev = Math.max(0, page - 1)
    setPage(prev)
    load(prev, eventFilter)
  }

  function handleNext() {
    const next = page + 1
    setPage(next)
    load(next, eventFilter)
  }

  const S = {
    root: { color: '#e8e8e8', fontFamily: "'Inter', sans-serif" },
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
    title: { fontSize: 20, fontWeight: 700, color: '#f0f0f0', margin: 0, flex: 1 },
    filterRow: { display: 'flex', gap: 12, alignItems: 'center' },
    select: {
      background: '#1a1a2e',
      border: '1px solid #2a2a4e',
      color: '#e8e8e8',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 13,
      fontFamily: "'Inter', sans-serif",
      cursor: 'pointer',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      background: '#111',
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid #1e1e2e',
    },
    th: {
      textAlign: 'left',
      padding: '11px 16px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: '#8b9ab8',
      background: '#0f0f1a',
      borderBottom: '1px solid #1e1e2e',
    },
    td: {
      padding: '10px 16px',
      fontSize: 13,
      color: '#ccc',
      borderBottom: '1px solid #1a1a2a',
      verticalAlign: 'top',
    },
    eventBadge: (type) => ({
      display: 'inline-block',
      background: `${eventColor(type)}22`,
      color: eventColor(type),
      border: `1px solid ${eventColor(type)}44`,
      borderRadius: 6,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
    }),
    pagination: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 20,
      justifyContent: 'flex-end',
    },
    pageBtn: (disabled) => ({
      background: disabled ? '#1a1a2e' : '#1e2638',
      border: '1px solid #2a3050',
      color: disabled ? '#444' : '#aaa',
      padding: '7px 14px',
      borderRadius: 7,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontFamily: "'Inter', sans-serif",
    }),
    empty: {
      textAlign: 'center',
      padding: '48px 24px',
      color: '#8b9ab8',
      fontSize: 14,
    },
    error: {
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.25)',
      color: '#f87171',
      borderRadius: 8,
      padding: '12px 16px',
      fontSize: 13,
      marginBottom: 16,
    },
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <h2 style={S.title}>📋 Audit Log</h2>
        <div style={S.filterRow}>
          <select
            style={S.select}
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
          >
            <option value="">All Events</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div style={S.error}>⚠️ {error}</div>}

      {loading ? (
        <div style={S.empty}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={S.empty}>No audit log entries found.</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Time</th>
              <th style={S.th}>Event</th>
              <th style={S.th}>Target</th>
              <th style={S.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id} style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#151520'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#777', fontSize: 12 }}>
                  {new Date(entry.created_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </td>
                <td style={S.td}>
                  <span style={S.eventBadge(entry.event_type)}>
                    {entry.event_type || '—'}
                  </span>
                </td>
                <td style={{ ...S.td, fontSize: 12, color: '#999' }}>
                  {entry.target_type && (
                    <span style={{ color: '#8b9ab8', marginRight: 4 }}>{entry.target_type}:</span>
                  )}
                  <span style={{ fontFamily: 'monospace' }}>
                    {entry.target_id ? entry.target_id.slice(0, 12) + '…' : '—'}
                  </span>
                </td>
                <td style={{ ...S.td, fontSize: 12, color: '#777', maxWidth: 320, overflow: 'hidden' }}>
                  {formatDetails(entry.details)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      <div style={S.pagination}>
        <span style={{ fontSize: 13, color: '#8b9ab8' }}>
          Page {page + 1}
        </span>
        <button
          style={S.pageBtn(page === 0)}
          disabled={page === 0}
          onClick={handlePrev}
        >
          ← Prev
        </button>
        <button
          style={S.pageBtn(!hasMore)}
          disabled={!hasMore}
          onClick={handleNext}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
