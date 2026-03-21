/**
 * AnnouncementPopup.jsx
 * Fetches active app announcements from Supabase and shows a dismissible
 * popup modal. Dismissed announcements are remembered in localStorage.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Format date + time range for display
function formatWindow(ann) {
  const parts = []
  if (ann.scheduled_date) {
    const d = new Date(ann.scheduled_date + 'T12:00:00') // noon avoids TZ shift
    parts.push(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))
  }
  if (ann.start_time && ann.end_time) {
    const fmt = (t) => {
      const [h, m] = t.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
    }
    parts.push(`${fmt(ann.start_time)} – ${fmt(ann.end_time)} PDT`)
  }
  return parts.join(' · ')
}

export default function AnnouncementPopup({ userRole }) {
  const [announcements, setAnnouncements] = useState([])
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    supabase.rpc('get_active_announcements')
      .then(({ data }) => {
        if (!data || !data.length) return
        // Filter by target role
        const roleMap = { super_admin: 'admins', admin: 'admins', manager: 'managers', user: 'all' }
        const myTarget = roleMap[userRole] || 'all'
        const relevant = data.filter(a => {
          if (a.target === 'all') return true
          if (a.target === 'admins' && (userRole === 'super_admin' || userRole === 'admin')) return true
          if (a.target === 'managers' && (userRole === 'manager' || userRole === 'admin' || userRole === 'super_admin')) return true
          return false
        })
        // Filter out already-dismissed ones
        const dismissed = JSON.parse(localStorage.getItem('kc_dismissed_announcements') || '[]')
        const unseen = relevant.filter(a => !dismissed.includes(a.id))
        if (unseen.length) {
          setAnnouncements(unseen)
          setCurrent(0)
          setVisible(true)
        }
      })
      .catch(() => {})
  }, [userRole])

  const dismiss = () => {
    const a = announcements[current]
    if (a) {
      const dismissed = JSON.parse(localStorage.getItem('kc_dismissed_announcements') || '[]')
      localStorage.setItem('kc_dismissed_announcements', JSON.stringify([...dismissed, a.id]))
    }
    if (current + 1 < announcements.length) {
      setCurrent(c => c + 1)
    } else {
      setVisible(false)
    }
  }

  if (!visible || !announcements[current]) return null

  const ann = announcements[current]
  const window_ = formatWindow(ann)
  const isMaintenance = ann.title.toLowerCase().includes('maintenance')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 20px', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#0f1521', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18, padding: '32px 28px', maxWidth: 460, width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', position: 'relative',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>
          {isMaintenance ? '🔧' : '📣'}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center',
          marginBottom: 12, letterSpacing: '-0.3px',
        }}>
          {ann.title}
        </div>

        {/* Scheduled window badge */}
        {window_ && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{
              background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)',
              color: '#fbbf24', fontSize: 12, fontWeight: 600, padding: '5px 14px',
              borderRadius: 20, letterSpacing: '0.02em',
            }}>
              🗓 {window_}
            </span>
          </div>
        )}

        {/* Message */}
        <div style={{
          fontSize: 14, color: '#8b9ab8', lineHeight: 1.7, textAlign: 'center',
          marginBottom: 24, whiteSpace: 'pre-wrap',
        }}>
          {ann.message}
        </div>

        {/* Counter if multiple */}
        {announcements.length > 1 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#4a5568', marginBottom: 16 }}>
            {current + 1} of {announcements.length}
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          Got it{announcements.length > 1 && current + 1 < announcements.length ? ' — Next' : ''}
        </button>

        {/* Footer note */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#374151', marginTop: 12 }}>
          — The KrakenCam Team
        </div>
      </div>
    </div>
  )
}
