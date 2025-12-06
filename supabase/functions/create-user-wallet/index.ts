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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const userId = body.userId

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: corsHeaders
      })
    }

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
      }), { status: 200, headers: corsHeaders })
    }

    // PROPER INSERT FORMAT
    const { data: newWallet, error: insertError } = await supabase
      .from('wallets')
      .insert([
        {
          user_id: userId,
          balance_fc: 0,
          locked_fc: 0
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error("Insert error:", insertError)
      return new Response(JSON.stringify({
        error: "Failed to create wallet",
        details: insertError.message
      }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      status: "created",
      wallet: newWallet
    }), { status: 200, headers: corsHeaders })

  } catch (err) {
    console.error("Error in create-user-wallet:", err)

    return new Response(JSON.stringify({
      error: "Internal server error",
      message: String(err)
    }), { status: 500, headers: corsHeaders })
  }
})
