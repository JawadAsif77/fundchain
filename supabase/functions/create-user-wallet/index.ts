// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const userId = user.id

    // SAFER: use maybeSingle() instead of single()
    const { data: existingWallet, error: checkError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError) {
      console.error("Wallet check error:", checkError)
      // DO NOT throw — just proceed to create wallet
    }

    if (existingWallet) {
      return new Response(JSON.stringify({
        status: "exists",
        wallet: existingWallet
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PROPER INSERT FORMAT (without array wrapper)
    const { data: newWallet, error: insertError } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        balance_fc: 0,
        locked_fc: 0
      })
      .select()
      .single()

    if (insertError) {
      console.error("Insert error:", insertError)
      return new Response(JSON.stringify({
        error: "Failed to create wallet",
        details: insertError.message
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      status: "created",
      wallet: newWallet
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error("Error in create-user-wallet:", err)

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
