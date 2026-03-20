import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://nszoateefidwhhsyexjd.supabase.co'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { orgName, userId, fullName, email, dateOfBirth, tier } = body

    // Validate required fields
    if (!orgName || !userId || !fullName || !email || !dateOfBirth) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: orgName, userId, fullName, email, dateOfBirth' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role key to bypass RLS
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing service role key' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Generate a URL-safe slug from org name
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) + '-' + Date.now().toString(36)

    // Determine subscription tier (default to 'trial')
    const subscriptionTier = ['capture_i', 'intelligence_ii', 'command_iii'].includes(tier)
      ? tier
      : 'trial'

    // 1. Create the organization row
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        slug,
        subscription_tier: subscriptionTier,
        subscription_status: 'trialing',
      })
      .select('id')
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return new Response(
        JSON.stringify({ error: `Failed to create organization: ${orgError.message}` }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const orgId = org.id

    // 2. Create the profile row with role='admin'
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        organization_id: orgId,
        user_id: userId,
        role: 'admin',
        full_name: fullName,
        email,
        date_of_birth: dateOfBirth,
        is_active: true,
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Attempt to clean up the org we just created
      await supabase.from('organizations').delete().eq('id', orgId)
      return new Response(
        JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, orgId }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
