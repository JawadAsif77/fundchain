// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Parse and validate request
    const { amountUsd } = await req.json()

    if (!amountUsd || amountUsd <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be a positive number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const exchangeRate = 1 
    const tokenAmount = amountUsd * exchangeRate

    // 3. Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // 4. Check if wallet exists
    const { data: existingWallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance_fc, locked_fc')
      .eq('user_id', user.id)
      .single()

    let newBalance = tokenAmount
    
    if (walletError && walletError.code === 'PGRST116') {
      // Wallet doesn't exist, create it
      const { error: insertError } = await supabaseClient
        .from('wallets')
        .insert({
          user_id: user.id,
          balance_fc: tokenAmount,
          locked_fc: 0,
          updated_at: new Date().toISOString()
        })
      
      if (insertError) throw new Error(`Failed to create wallet: ${insertError.message}`)
    } else if (walletError) {
      throw new Error(`Failed to fetch wallet: ${walletError.message}`)
    } else {
      // Wallet exists, update balance
      newBalance = Number(existingWallet.balance_fc || 0) + tokenAmount
      
      const { error: updateError } = await supabaseClient
        .from('wallets')
        .update({
          balance_fc: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
      
      if (updateError) throw new Error(`Failed to update wallet: ${updateError.message}`)
    }

    // 5. Log Transaction
    const { error: txError } = await supabaseClient
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount_fc: tokenAmount,
        type: 'buy_fc',
        metadata: {
          amount_usd: amountUsd,
          exchange_rate: exchangeRate,
          method: 'test_purchase',
          description: `Bought ${tokenAmount} FC with ${amountUsd} USD (Test)`
        }
      })

    if (txError) {
      console.error('Transaction log error:', txError)
      // Don't fail the whole operation if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully bought ${tokenAmount} FC`,
        newBalance,
        balanceFc: newBalance
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Exchange USD to FC error:', message)
    
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})