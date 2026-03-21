/**
 * AdminFeatureFlags.jsx
 * Toggle features on/off globally, per tier, or per org.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { adminRpc } from '../../lib/adminFetch'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const TIERS = ['capture_i', 'intelligence_ii', 'command_iii']
const TIER_LABEL = { capture_i: 'Capture I', intelligence_ii: 'Intelligence II', command_iii: 'Command III' }
const TIER_COLOR = { capture_i: '#4ec9b0', intelligence_ii: '#00d4ff', command_iii: '#c792ea' }

const S = {
  card: { background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '18px 20px', marginBottom: 10 },
  row: { display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  label: { fontSize: 13, fontWeight: 700, color: '#e8e8e8', marginBottom: 2 },
  desc: { fontSize: 12, color: '#555', marginTop: 2, lineHeight: 1.5 },
  toggle: (on) => ({
    width: 44, height: 24, borderRadius: 12, background: on ? '#00d4ff' : '#333',
    border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
  }),
  thumb: (on) => ({
    position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20,
    borderRadius: '50%', background: 'white', transition: 'left .2s',
    boxShadow: '0 1px 4px rgba(0,0,0,.4)',
  }),
  tierBadge: (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
    borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    background: active ? `${color}22` : 'rgba(255,255,255,.04)',
    color: active ? color : '#555',
    border: `1px solid ${active ? color + '55' : '#333'}`,
    transition: 'all .15s',
  }),
  orgBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(0,212,255,.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,.2)' },
  input: { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 6, color: '#e8e8e8', padding: '7px 10px', fontSize: 12, outline: 'none', flex: 1, fontFamily: 'Inter,sans-serif' },
  btn: { background: 'rgba(37,99,235,.15)', border: '1px solid rgba(37,99,235,.3)', color: '#60a5fa', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  removeBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' },
  saving: { fontSize: 11, color: '#555', fontStyle: 'italic' },
}

async function saveFlag(key, patch) {
  const anonKey = SUPABASE_ANON
  const url     = SUPABASE_URL
  await fetch(`${url}/rest/v1/feature_flags?key=eq.${key}`, {
    method: 'PATCH',
    headers: {
      'apikey': anonKey, 'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
}

async function loadFlags() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/feature_flags?select=*&order=key`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
  })
  return r.json()
}

async function loadOrgs() {
  return adminRpc('admin_get_all_orgs')
}

function FlagRow({ flag, orgs, onUpdated }) {
  const [saving,     setSaving]     = useState(false)
  const [orgSearch,  setOrgSearch]  = useState('')
  const [showOrgAdd, setShowOrgAdd] = useState(false)

  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase()) &&
    !flag.allowed_org_ids?.includes(o.id)
  )

  const update = async (patch) => {
    setSaving(true)
    await saveFlag(flag.key, patch)
    onUpdated()
    setSaving(false)
  }

  const toggleTier = async (tier) => {
    const current = flag.allowed_tiers || []
    const next = current.includes(tier) ? current.filter(t => t !== tier) : [...current, tier]
    await update({ allowed_tiers: next })
  }

  const addOrg = async (orgId) => {
    const current = flag.allowed_org_ids || []
    if (current.includes(orgId)) return
    await update({ allowed_org_ids: [...current, orgId] })
    setOrgSearch(''); setShowOrgAdd(false)
  }

  const removeOrg = async (orgId) => {
    const current = flag.allowed_org_ids || []
    await update({ allowed_org_ids: current.filter(id => id !== orgId) })
  }

  return (
    <div style={S.card}>
      <div style={S.row}>
        {/* Toggle */}
        <button style={S.toggle(flag.enabled)} onClick={() => update({ enabled: !flag.enabled })}>
          <div style={S.thumb(flag.enabled)} />
        </button>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.label}>{flag.label || flag.key}</span>
            <code style={{ fontSize: 10, color: '#555', background: '#111', padding: '1px 6px', borderRadius: 4 }}>{flag.key}</code>
            {saving && <span style={S.saving}>saving…</span>}
          </div>
          <div style={S.desc}>{flag.description}</div>

          {/* Tier toggles */}
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#444', marginRight: 2 }}>Tiers:</span>
            {TIERS.map(t => (
              <span key={t} style={S.tierBadge(flag.allowed_tiers?.includes(t), TIER_COLOR[t])} onClick={() => toggleTier(t)}>
                {flag.allowed_tiers?.includes(t) ? '✓' : '+'} {TIER_LABEL[t]}
              </span>
            ))}
          </div>

          {/* Org overrides */}
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#444', marginRight: 2 }}>Org overrides:</span>
            {(flag.allowed_org_ids || []).map(orgId => {
              const org = orgs.find(o => o.id === orgId)
              return (
                <span key={orgId} style={S.orgBadge}>
                  {org?.name || orgId.slice(0, 8)}
                  <button style={S.removeBtn} onClick={() => removeOrg(orgId)} title="Remove">×</button>
                </span>
              )
            })}
            <button style={{ ...S.btn, fontSize: 11, padding: '2px 8px' }} onClick={() => setShowOrgAdd(s => !s)}>
              + Add org
            </button>
          </div>

          {/* Org search dropdown */}
          {showOrgAdd && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, position: 'relative' }}>
              <input style={S.input} placeholder="Search org name…" value={orgSearch} onChange={e => setOrgSearch(e.target.value)} autoFocus />
              {orgSearch && filteredOrgs.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0f1521', border: '1px solid #252525', borderRadius: 8, zIndex: 20, maxHeight: 160, overflowY: 'auto' }}>
                  {filteredOrgs.slice(0, 8).map(o => (
                    <div key={o.id} onClick={() => addOrg(o.id)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#e8e8e8' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {o.name}
                    </div>
                  ))}
                </div>
              )}
              {orgSearch && filteredOrgs.length === 0 && (
                <div style={{ fontSize: 12, color: '#555', padding: '6px 0', alignSelf: 'center' }}>No matches</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminFeatureFlags() {
  const [flags,   setFlags]   = useState([])
  const [orgs,    setOrgs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [newKey,  setNewKey]  = useState('')
  const [newLabel,setNewLabel]= useState('')
  const [newDesc, setNewDesc] = useState('')
  const [adding,  setAdding]  = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [f, o] = await Promise.all([loadFlags(), loadOrgs()])
    setFlags(Array.isArray(f) ? f : [])
    setOrgs(Array.isArray(o) ? o : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addFlag = async () => {
    if (!newKey.trim() || !newLabel.trim()) return
    setAdding(true)
    const anonKey = SUPABASE_ANON
    await fetch(`${SUPABASE_URL}/rest/v1/feature_flags`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ key: newKey.trim().toLowerCase().replace(/\s+/g, '_'), label: newLabel.trim(), description: newDesc.trim(), enabled: false, allowed_tiers: [], allowed_org_ids: [] }),
    })
    setNewKey(''); setNewLabel(''); setNewDesc(''); setShowAdd(false); setAdding(false)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ccc' }}>🚩 Feature Flags</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Toggle features per tier or specific org — no deploy needed.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn} onClick={load}>↻ Refresh</button>
          <button style={{ ...S.btn, color: '#4ade80', borderColor: 'rgba(34,197,94,.3)', background: 'rgba(34,197,94,.1)' }} onClick={() => setShowAdd(s => !s)}>+ New Flag</button>
        </div>
      </div>

      {/* New flag form */}
      {showAdd && (
        <div style={{ ...S.card, border: '1px solid rgba(0,212,255,.2)', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#00d4ff', marginBottom: 12 }}>New Feature Flag</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Key (snake_case)</label>
              <input style={S.input} placeholder="my_new_feature" value={newKey} onChange={e => setNewKey(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Label</label>
              <input style={S.input} placeholder="My New Feature" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Description</label>
            <input style={S.input} placeholder="What does this feature do?" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btn} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={{ ...S.btn, color: '#4ade80', borderColor: 'rgba(34,197,94,.3)', background: 'rgba(34,197,94,.1)' }} disabled={adding || !newKey || !newLabel} onClick={addFlag}>
              {adding ? '⏳ Adding…' : '+ Create Flag'}
            </button>
          </div>
        </div>
      )}

      {loading
        ? <div style={{ color: '#555', fontSize: 13 }}>Loading flags…</div>
        : flags.map(flag => <FlagRow key={flag.key} flag={flag} orgs={orgs} onUpdated={load} />)
      }

      <div style={{ fontSize: 12, color: '#333', marginTop: 16, lineHeight: 1.7 }}>
        💡 <strong style={{ color: '#444' }}>How to use in code:</strong> import {'{ useFlag }'} from <code style={{ color: '#60a5fa' }}>../lib/featureFlags</code> and check <code style={{ color: '#60a5fa' }}>useFlag('ai_report_writer')</code>. Wrap the app with <code style={{ color: '#60a5fa' }}>{'<FlagsProvider>'}</code> to enable.
      </div>
    </div>
  )
}
