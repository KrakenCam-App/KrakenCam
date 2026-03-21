/**
 * adminFetch.js
 * Raw fetch helpers that bypass Supabase JS client auth lock.
 * Needed for Brave and other privacy browsers that steal IndexedDB locks.
 */

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

function headers() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
  }
}

// GET from a table
export async function adminFrom(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

// POST to a table (insert/upsert)
export async function adminInsert(table, body, upsert = false) {
  const prefer = upsert ? 'resolution=merge-duplicates' : 'return=representation'
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...headers(), Prefer: prefer },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// PATCH a table
export async function adminUpdate(table, body, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method:  'PATCH',
    headers: { ...headers(), Prefer: 'return=representation' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// Call an RPC function
export async function adminRpc(fn, args = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data ? [data] : []
}
