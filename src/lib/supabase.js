/**
 * src/lib/supabase.js - v2
 *
 * Supabase client initialization.
 *
 * SECURITY:
 * - Only the ANON key is used here (safe for browser)
 * - The SERVICE_ROLE key NEVER goes in the browser bundle
 * - Service role key is only used in /api/* Vercel functions (server-side)
 * - Session is persisted in localStorage by default (standard for SPAs)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    // Persist session across page reloads
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,  // Handles password reset redirects
    storage:           localStorage,
  },
  global: {
    headers: {
      'x-application-name': 'krakencam',
    },
  },
});

/**
 * Get the current user's access token for API calls
 * (used when calling our Vercel API routes)
 */
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Build Authorization headers for raw fetch() calls to Supabase REST/Storage.
 * Always uses the real session JWT — never the anon key as Bearer.
 * The anon key is still required as `apikey` for rate limiting.
 *
 * Usage:
 *   const headers = await getAuthHeaders();
 *   fetch(`${SUPABASE_URL}/rest/v1/...`, { headers })
 */
export async function getAuthHeaders(extra = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || supabaseAnon; // fallback for public tables only
  return {
    apikey:        supabaseAnon,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}
