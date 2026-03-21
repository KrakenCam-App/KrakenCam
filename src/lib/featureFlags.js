/**
 * featureFlags.js
 * Fetch feature flags from Supabase and expose a hook/context.
 * Uses raw fetch to avoid Brave IndexedDB lock issues.
 */

import React, { createContext, useContext, useEffect, useState } from 'react'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const FlagsContext = createContext({})

/**
 * Given the flag row + the current org's tier and org ID,
 * return true if this org has access to the feature.
 */
function orgHasFlag(flag, orgTier, orgId) {
  if (!flag) return false
  if (!flag.enabled) return false
  // Specific org override — always grants access
  if (orgId && flag.allowed_org_ids?.includes(orgId)) return true
  // Tier check
  if (orgTier && flag.allowed_tiers?.includes(orgTier)) return true
  // No tiers and no orgs = disabled for everyone (unless specific org listed)
  return false
}

export function FlagsProvider({ children, orgTier, orgId }) {
  const [flags, setFlags] = useState({})
  const [raw,   setRaw]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/feature_flags?select=*`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
    })
      .then(r => r.json())
      .then(rows => {
        if (!Array.isArray(rows)) return
        setRaw(rows)
        const map = {}
        for (const row of rows) {
          map[row.key] = orgHasFlag(row, orgTier, orgId)
        }
        setFlags(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgTier, orgId])

  return (
    <FlagsContext.Provider value={{ flags, raw, loading }}>
      {children}
    </FlagsContext.Provider>
  )
}

/** Hook: returns { flags, raw, loading } */
export function useFlags() {
  return useContext(FlagsContext)
}

/** Convenience: check a single flag */
export function useFlag(key) {
  const { flags } = useContext(FlagsContext)
  return !!flags[key]
}
