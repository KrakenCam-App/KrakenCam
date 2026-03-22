/**
 * ClientPortalPage.jsx
 * Public-facing client portal — no auth required.
 * Accessed via /client-portal/[slug]
 *
 * Data source: published_portals table (Supabase, public read).
 * The contractor publishes portal data when they share the link.
 */

import React, { useState, useEffect } from 'react'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

async function fetchPortal(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/published_portals?slug=eq.${encodeURIComponent(slug)}&active=eq.true&select=project_data,portal_config,brand_color,org_id,organizations(name)&limit=1`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
  )
  const data = await res.json()
  return Array.isArray(data) && data[0] ? data[0] : null
}

function PortalLoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', background:'#f0f6ff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🦑</div>
        <div style={{ fontSize:14, color:'#68819b' }}>Loading your portal…</div>
      </div>
    </div>
  )
}

function PortalNotFound() {
  return (
    <div style={{ minHeight:'100vh', background:'#f0f6ff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif' }}>
      <div style={{ textAlign:'center', maxWidth:400 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
        <div style={{ fontSize:22, fontWeight:700, color:'#17324d', marginBottom:8 }}>Portal not found</div>
        <div style={{ fontSize:14, color:'#68819b', lineHeight:1.7 }}>
          This portal link may have expired or been deactivated. Contact your project team for a new link.
        </div>
      </div>
    </div>
  )
}

function PasswordGate({ onUnlock, brandColor = '#2b7fe8' }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  return (
    <div style={{ minHeight:'100vh', background:'#f0f6ff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif', padding:'0 20px' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px 32px', maxWidth:380, width:'100%', boxShadow:'0 12px 48px rgba(20,42,74,.1)', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
        <div style={{ fontSize:20, fontWeight:700, color:'#17324d', marginBottom:8 }}>Protected Portal</div>
        <div style={{ fontSize:14, color:'#68819b', marginBottom:24 }}>Enter the password provided by your project team.</div>
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && onUnlock(input, setError)}
          placeholder="Portal password…"
          style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:`1.5px solid ${error ? '#e85a3a' : '#dae4f0'}`, fontSize:14, marginBottom:8, outline:'none', fontFamily:'Inter,sans-serif' }}
          autoFocus
        />
        {error && <div style={{ color:'#e85a3a', fontSize:13, marginBottom:8 }}>{error}</div>}
        <button
          onClick={() => onUnlock(input, setError)}
          style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:brandColor, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          View Portal →
        </button>
      </div>
    </div>
  )
}

export default function ClientPortalPage({ slug }) {
  const [loading,   setLoading]   = useState(true)
  const [portalRow, setPortalRow] = useState(null)
  const [unlocked,  setUnlocked]  = useState(false)
  const [clientNote, setClientNote] = useState('')
  const [noteSent,  setNoteSent]  = useState(false)

  useEffect(() => {
    fetchPortal(slug).then(row => {
      setPortalRow(row)
      setLoading(false)
      if (row) {
        const cfg = row.portal_config || {}
        // Auto-unlock if no password
        if (!cfg.passwordEnabled || !cfg.password) setUnlocked(true)
      }
    }).catch(() => setLoading(false))
  }, [slug])

  if (loading) return <PortalLoadingScreen />
  if (!portalRow) return <PortalNotFound />

  const project   = portalRow.project_data || {}
  const portal    = portalRow.portal_config || {}
  const brandColor = portalRow.brand_color || '#2b7fe8'
  const orgName   = portalRow.organizations?.name || 'Your Project Team'

  const handleUnlock = (input, setError) => {
    if (input === portal.password) {
      setUnlocked(true)
    } else {
      setError('Incorrect password. Please try again.')
    }
  }

  if (!unlocked) return <PasswordGate onUnlock={handleUnlock} brandColor={brandColor} />

  // Approved items only
  const photos   = portal.sharePhotos   ? (project.photos   || []).filter(p => p.clientPortalVisible) : []
  const videos   = portal.shareVideos   ? (project.videos   || []).filter(v => v.clientPortalVisible) : []
  const reports  = portal.shareReports  ? (project.reports  || []).filter(r => r.clientPortalVisible) : []
  const files    = portal.shareFiles    ? (project.files    || []).filter(f => f.clientPortalVisible) : []
  const sketches = portal.shareSketches ? (project.sketches || []).filter(s => s.clientPortalVisible) : []

  const timelineStages = [
    ['approved','Approved'],['planning','Planning'],['in_progress','In Progress'],
    ['final_walk','Final Walk'],['completion_phase','Completion'],['invoiced','Invoiced'],['completed','Completed'],
  ]
  const activeStageIdx = timelineStages.findIndex(([id]) => id === project.timelineStage)

  const sendNote = async () => {
    if (!clientNote.trim()) return
    const noteId = Math.random().toString(36).slice(2)
    const note = { id: noteId, text: clientNote.trim(), createdAt: new Date().toISOString() }

    // 1. Append note to published_portals
    const existing = portalRow.project_data?.clientNotes || []
    await fetch(`${SUPABASE_URL}/rest/v1/published_portals?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ project_data: { ...portalRow.project_data, clientNotes: [...existing, note] } })
    })

    // 2. Write a portal_notifications row — triggers Realtime on the admin app
    if (portalRow.org_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/portal_notifications`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          organization_id: portalRow.org_id,
          project_id:      project.id || '',
          project_title:   project.title || 'Project',
          slug,
          client_note:     note.text,
        })
      }).catch(() => {}) // non-fatal
    }

    setClientNote(''); setNoteSent(true)
    setTimeout(() => setNoteSent(false), 3000)
  }

  const S = {
    page: { minHeight:'100vh', background:'#f0f6ff', fontFamily:'Inter,sans-serif', paddingBottom:40 },
    header: { background:'#fff', borderBottom:'1px solid #dae4f0', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    logo: { fontSize:22, fontWeight:800, color: brandColor },
    section: { background:'#fff', border:'1px solid #dae4f0', borderRadius:18, padding:'22px 22px 20px', boxShadow:'0 8px 24px rgba(20,42,74,.06)', marginBottom:16 },
    sectionTitle: { fontSize:17, fontWeight:800, color:'#17324d', marginBottom:4 },
    sectionSub: { fontSize:13, color:'#68819b', marginBottom:16 },
    pill: (active, color) => ({ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background: active ? `${color}22` : '#f0f4f8', color: active ? color : '#8b9ab8', border:`1px solid ${active ? color+'44' : 'transparent'}` }),
    photoGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 },
    photoItem: { borderRadius:12, overflow:'hidden', border:'1px solid #dae4f0', background:'#f8fbff' },
    emptyState: { textAlign:'center', padding:'32px', color:'#8b9ab8', fontSize:13 },
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>🦑 {orgName}</div>
        <div style={{ fontSize:13, color:'#68819b' }}>Client Portal</div>
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding:'24px 16px 0' }}>

        {/* Project title */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:24, fontWeight:800, color:'#17324d', marginBottom:4 }}>{project.title || 'Your Project'}</div>
          {project.address && <div style={{ fontSize:14, color:'#68819b' }}>📍 {[project.address, project.city, project.state].filter(Boolean).join(', ')}</div>}
        </div>

        {/* Timeline */}
        {portal.shareProgress && activeStageIdx >= 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Project Progress</div>
            <div style={S.sectionSub}>Current stage of your project</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {timelineStages.map(([id, label], i) => (
                <span key={id} style={S.pill(i <= activeStageIdx, brandColor)}>
                  {i < activeStageIdx ? '✓ ' : i === activeStageIdx ? '● ' : ''}{label}
                </span>
              ))}
            </div>
            {project.timelineClientNotes?.[project.timelineStage] && (
              <div style={{ fontSize:13, color:'#4a6580', background:'#f0f6ff', borderRadius:10, padding:'10px 14px', lineHeight:1.6 }}>
                {project.timelineClientNotes[project.timelineStage]}
              </div>
            )}
          </div>
        )}

        {/* Team messages */}
        {(portal.teamMessages || []).length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>📣 Messages from the Team</div>
            {[...(portal.teamMessages || [])].reverse().map(m => (
              <div key={m.id} style={{ padding:'10px 14px', background:'#f8fbff', borderRadius:10, border:'1px solid #dae4f0', marginBottom:8 }}>
                <div style={{ fontSize:13, color:'#17324d', lineHeight:1.6 }}>{m.text}</div>
                <div style={{ fontSize:11, color:'#8b9ab8', marginTop:4 }}>{m.author} · {m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}</div>
              </div>
            ))}
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>📷 Project Photos</div>
            <div style={S.sectionSub}>{photos.length} photo{photos.length!==1?'s':''} shared with you</div>
            <div style={S.photoGrid}>
              {photos.map(p => (
                <div key={p.id} style={S.photoItem}>
                  {p.dataUrl ? <img src={p.dataUrl} alt={p.name} style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover', display:'block' }} /> : <div style={{ aspectRatio:'4/3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#c0d0e0' }}>📷</div>}
                  <div style={{ padding:'8px 10px', fontSize:12, color:'#4a6580', fontWeight:600 }}>{p.name || 'Photo'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Videos */}
        {videos.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>🎬 Videos</div>
            {videos.map(v => (
              <div key={v.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f8fbff', borderRadius:10, border:'1px solid #dae4f0', marginBottom:8 }}>
                <span style={{ fontSize:24 }}>🎬</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#17324d' }}>{v.name || 'Video'}</div>
                  <div style={{ fontSize:12, color:'#8b9ab8' }}>{v.room || ''}</div>
                </div>
                {v.dataUrl && <a href={v.dataUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, fontWeight:700, color:brandColor, textDecoration:'none' }}>Watch</a>}
              </div>
            ))}
          </div>
        )}

        {/* Reports */}
        {reports.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>📄 Reports</div>
            {reports.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f8fbff', borderRadius:10, border:'1px solid #dae4f0', marginBottom:8 }}>
                <span style={{ fontSize:20 }}>📄</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#17324d' }}>{r.title || 'Report'}</div>
                  <div style={{ fontSize:12, color:'#8b9ab8' }}>{r.reportType} · {r.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Files */}
        {files.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>📎 Files</div>
            {files.map(f => (
              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f8fbff', borderRadius:10, border:'1px solid #dae4f0', marginBottom:8 }}>
                <span style={{ fontSize:20 }}>📎</span>
                <div style={{ flex:1, fontSize:13, fontWeight:600, color:'#17324d' }}>{f.name}</div>
                {f.dataUrl && <a href={f.dataUrl} download={f.name} style={{ fontSize:12, fontWeight:700, color:brandColor, textDecoration:'none' }}>Download</a>}
              </div>
            ))}
          </div>
        )}

        {/* Client note form */}
        {portal.allowClientNotes !== false && (
          <div style={S.section}>
            <div style={S.sectionTitle}>💬 Send a Message</div>
            <div style={S.sectionSub}>Questions or feedback? Send a note to your project team.</div>
            <textarea
              value={clientNote}
              onChange={e => setClientNote(e.target.value)}
              placeholder="Type your message here…"
              style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'1.5px solid #dae4f0', fontSize:13, minHeight:80, resize:'vertical', fontFamily:'Inter,sans-serif', marginBottom:10, outline:'none' }}
            />
            {noteSent && <div style={{ color:'#3dba7e', fontSize:13, fontWeight:600, marginBottom:8 }}>✓ Message sent!</div>}
            <button
              onClick={sendNote}
              disabled={!clientNote.trim()}
              style={{ padding:'10px 22px', borderRadius:10, border:'none', background: clientNote.trim() ? brandColor : '#e0e8f0', color: clientNote.trim() ? '#fff' : '#8b9ab8', fontSize:13, fontWeight:700, cursor: clientNote.trim() ? 'pointer' : 'default' }}>
              Send Message
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:'center', fontSize:12, color:'#8b9ab8', marginTop:24 }}>
          Powered by <strong style={{ color:brandColor }}>KrakenCam</strong> · {orgName}
        </div>
      </div>
    </div>
  )
}
