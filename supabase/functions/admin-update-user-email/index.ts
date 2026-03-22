/**
 * admin-update-user-email edge function
 * Allows super_admins to update a team member's login email in Supabase Auth.
 * Requires service role — only callable by authenticated super_admins.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller is admin or super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: profile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('user_id', caller.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    const { user_id, new_email } = await req.json()
    if (!user_id || !new_email) {
      return new Response(JSON.stringify({ error: 'user_id and new_email required' }), { status: 400, headers: corsHeaders })
    }

    // Update auth email using service role
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { error } = await adminClient.auth.admin.updateUserById(user_id, { email: new_email })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }

    // Also update the profiles table
    await adminClient.from('profiles').update({ email: new_email }).eq('user_id', user_id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
