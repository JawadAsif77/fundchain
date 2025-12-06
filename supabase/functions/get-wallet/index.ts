// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body = await req.json()
    const userId = body.userId

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request: userId is required and must be a string' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Query wallets table
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_fc, locked_fc')
      .eq('user_id', userId)
      .single()

    // Handle wallet not found
    if (walletError && walletError.code === 'PGRST116') {
      return new Response(
        JSON.stringify({ 
          status: 'not_found'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (walletError) {
      throw new Error(`Failed to fetch wallet: ${walletError.message}`)
    }

    // Return wallet details
    return new Response(
      JSON.stringify({ 
        status: 'success',
        balanceFc: wallet.balance_fc || 0,
        lockedFc: wallet.locked_fc || 0
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (err) {
    console.error('Error in get-wallet:', err)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: String(err)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
