/**
 * AdminReleases.jsx
 * App version / release notes manager.
 * Published versions show as a "What's New" popup to users.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { adminFrom, adminInsert, adminUpdate, adminDelete } from '../../lib/adminFetch'

const NOTE_TYPES = [
  { value:'new',     label:'✨ New',     color:'#4ade80' },
  { value:'improved',label:'⚡ Improved', color:'#00d4ff' },
  { value:'fixed',   label:'🔧 Fixed',   color:'#fbbf24' },
  { value:'removed', label:'🗑 Removed',  color:'#f87171' },
]

const S = {
  card: { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'20px 22px', marginBottom:12 },
  input: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'8px 11px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  select: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'8px 11px', fontSize:13, outline:'none', boxSizing:'border-box' },
  btn: { background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.3)', color:'#60a5fa', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 },
  greenBtn: { background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', color:'#4ade80', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 },
  badge: (c) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${c}22`, color:c, border:`1px solid ${c}44` }),
  noteRow: { display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  removeBtn: { background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', color:'#f87171', borderRadius:5, padding:'3px 8px', fontSize:11, cursor:'pointer' },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px' },
  modalBox: { background:'#0f1521', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:'28px 24px', width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' },
}

function NoteTypeTag({ type }) {
  const meta = NOTE_TYPES.find(t => t.value === type) || NOTE_TYPES[0]
  return <span style={S.badge(meta.color)}>{meta.label}</span>
}

export default function AdminReleases() {
  const [versions, setVersions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editVer,  setEditVer]  = useState(null)
  const [saving,   setSaving]   = useState(false)

  const blankNote = { type:'new', text:'' }
  const [form, setForm] = useState({ version:'', title:'', release_date: new Date().toISOString().slice(0,10), notes:[{ ...blankNote }], published:false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFrom('app_versions', 'select=*&order=release_date.desc')
      setVersions(Array.isArray(data) ? data : [])
    } catch (e) {
      console.warn('AdminReleases load error:', e)
      setVersions([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setForm({ version:'', title:'', release_date:new Date().toISOString().slice(0,10), notes:[{...blankNote}], published:false })
    setEditVer(null); setShowForm(true)
  }

  const openEdit = (v) => {
    setForm({ version:v.version, title:v.title||'', release_date:v.release_date||new Date().toISOString().slice(0,10), notes: Array.isArray(v.notes) && v.notes.length ? v.notes : [{...blankNote}], published:v.published })
    setEditVer(v); setShowForm(true)
  }

  const addNote = () => setForm(f => ({ ...f, notes:[...f.notes, {...blankNote}] }))
  const removeNote = (i) => setForm(f => ({ ...f, notes:f.notes.filter((_,idx) => idx!==i) }))
  const updateNote = (i, key, val) => setForm(f => ({ ...f, notes:f.notes.map((n,idx) => idx===i ? {...n,[key]:val} : n) }))

  const save = async () => {
    if (!form.version.trim() || !form.title.trim()) return
    setSaving(true)
    const payload = {
      version: form.version.trim(),
      title: form.title.trim(),
      release_date: form.release_date,
      notes: form.notes.filter(n => n.text.trim()),
      published: form.published,
    }
    try {
      if (editVer) {
        await adminUpdate('app_versions', payload, `version=eq.${encodeURIComponent(editVer.version)}`)
      } else {
        await adminInsert('app_versions', payload)
      }
    } catch (e) {
      console.error('AdminReleases save error:', e)
    }
    setSaving(false); setShowForm(false); load()
  }

  const togglePublish = async (v) => {
    try {
      await adminUpdate('app_versions', { published: !v.published }, `version=eq.${encodeURIComponent(v.version)}`)
      load()
    } catch (e) {
      console.error('togglePublish error:', e)
    }
  }

  const deleteVersion = async (v) => {
    if (!window.confirm(`Delete version ${v.version}?`)) return
    try {
      await adminDelete('app_versions', `version=eq.${encodeURIComponent(v.version)}`)
      load()
    } catch (e) {
      console.error('deleteVersion error:', e)
    }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#ccc' }}>📦 Release Notes</div>
          <div style={{ fontSize:12, color:'#8b9ab8', marginTop:2 }}>Manage app versions and publish "What's New" notes to users.</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={S.btn} onClick={load}>↻ Refresh</button>
          <button style={S.greenBtn} onClick={openNew}>+ New Version</button>
        </div>
      </div>

      {loading && <div style={{ color:'#8b9ab8', fontSize:13 }}>Loading…</div>}
      {!loading && versions.length === 0 && <div style={{ color:'#8b9ab8', fontSize:13, padding:20, textAlign:'center' }}>No versions yet. Create your first release.</div>}

      {versions.map(v => (
        <div key={v.version} style={{ ...S.card, borderLeft:`3px solid ${v.published?'#4ade80':'#6a7a8a'}` }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:16, fontWeight:700, color:'#e8e8e8' }}>v{v.version}</span>
                <span style={{ fontSize:14, color:'#8b9ab8' }}>{v.title}</span>
                <span style={S.badge(v.published?'#4ade80':'#8b9ab8')}>{v.published?'Published':'Draft'}</span>
                <span style={{ fontSize:11, color:'#7a8a9a' }}>{v.release_date}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {(v.notes||[]).map((n,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                    <NoteTypeTag type={n.type} />
                    <span style={{ color:'#ccc' }}>{n.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button style={{ ...S.btn, fontSize:11, padding:'4px 10px' }} onClick={() => openEdit(v)}>Edit</button>
              <button
                onClick={() => togglePublish(v)}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:7, cursor:'pointer', fontWeight:600, background: v.published?'rgba(239,68,68,.1)':'rgba(34,197,94,.1)', color:v.published?'#f87171':'#4ade80', border:`1px solid ${v.published?'rgba(239,68,68,.3)':'rgba(34,197,94,.3)'}` }}
              >
                {v.published ? 'Unpublish' : 'Publish'}
              </button>
              <button style={{ ...S.btn, fontSize:11, padding:'4px 10px', color:'#f87171', background:'rgba(239,68,68,.1)', borderColor:'rgba(239,68,68,.3)' }} onClick={() => deleteVersion(v)}>Delete</button>
            </div>
          </div>
        </div>
      ))}

      <div style={{ fontSize:12, color:'#6a7a8a', marginTop:8, lineHeight:1.8 }}>
        💡 <strong style={{ color:'#7a8a9a' }}>Published</strong> versions show as a "What's New" popup to users the first time they log in after a release. Users dismiss it once and won't see it again.
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:20 }}>{editVer ? `✏️ Edit v${editVer.version}` : '📦 New Version'}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>Version *</div>
                <input style={S.input} value={form.version} onChange={e => setForm(f=>({...f,version:e.target.value}))} placeholder="1.2.0" />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>Release Date</div>
                <input style={S.input} type="date" value={form.release_date} onChange={e => setForm(f=>({...f,release_date:e.target.value}))} />
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>Title *</div>
              <input style={S.input} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Flash Camera Update" />
            </div>

            <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Release Notes</div>
            {form.notes.map((n,i) => (
              <div key={i} style={S.noteRow}>
                <select style={{ ...S.select, width:130, flexShrink:0 }} value={n.type} onChange={e => updateNote(i,'type',e.target.value)}>
                  {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input style={{ ...S.input, flex:1 }} value={n.text} onChange={e => updateNote(i,'text',e.target.value)} placeholder="Describe the change…" />
                {form.notes.length > 1 && <button style={S.removeBtn} onClick={() => removeNote(i)}>×</button>}
              </div>
            ))}
            <button style={{ ...S.btn, fontSize:11, padding:'4px 10px', marginBottom:16 }} onClick={addNote}>+ Add note</button>

            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#ccc', cursor:'pointer', marginBottom:20 }}>
              <input type="checkbox" checked={form.published} onChange={e => setForm(f=>({...f,published:e.target.checked}))} />
              Publish immediately (users will see "What's New" popup on next login)
            </label>

            <div style={{ display:'flex', gap:10 }}>
              <button style={{ ...S.btn, flex:1, background:'transparent', color:'#888', border:'1px solid #333' }} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...S.greenBtn, flex:2 }} disabled={saving || !form.version || !form.title} onClick={save}>
                {saving ? '⏳ Saving…' : editVer ? '✓ Save Changes' : '📦 Create Version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
