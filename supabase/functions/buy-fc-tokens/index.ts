// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fixed conversion rate: 1 USD = 1 FC
const USD_TO_FC_RATE = 1

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
    const amountUsd = body.amountUsd

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

    if (!amountUsd || typeof amountUsd !== 'number' || amountUsd <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request: amountUsd is required and must be a positive number' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Convert USD to FC tokens
    const amountFc = amountUsd * USD_TO_FC_RATE

    // Execute transaction: Update user wallet, platform wallet, and create transaction record
    // We'll use multiple queries in sequence to simulate a transaction
    
    // Step 1: Get current user wallet balance
    const { data: userWallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_fc')
      .eq('user_id', userId)
      .single()

    if (walletError) {
      throw new Error(`Failed to fetch user wallet: ${walletError.message}`)
    }

    // Step 2: Update user wallet balance
    const newBalance = (userWallet.balance_fc || 0) + amountFc
    
    const { error: updateWalletError } = await supabase
      .from('wallets')
      .update({ 
        balance_fc: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateWalletError) {
      throw new Error(`Failed to update user wallet: ${updateWalletError.message}`)
    }

    // Step 3: Update platform wallet
    // First get the platform wallet (should only be one row)
    const { data: platformWallets, error: platformFetchError } = await supabase
      .from('platform_wallet')
      .select('id, balance_fc')
      .limit(1)

    if (platformFetchError || !platformWallets || platformWallets.length === 0) {
      throw new Error('Platform wallet not found')
    }

    const platformWallet = platformWallets[0]
    const newPlatformBalance = (platformWallet.balance_fc || 0) + amountFc

    const { error: updatePlatformError } = await supabase
      .from('platform_wallet')
      .update({ 
        balance_fc: newPlatformBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', platformWallet.id)

    if (updatePlatformError) {
      throw new Error(`Failed to update platform wallet: ${updatePlatformError.message}`)
    }

    // Step 4: Create transaction record
    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        amount_fc: amountFc,
        type: 'BUY_FC',
        metadata: {
          amount_usd: amountUsd,
          conversion_rate: USD_TO_FC_RATE,
          timestamp: new Date().toISOString()
        }
      })

    if (transactionError) {
      throw new Error(`Failed to create transaction record: ${transactionError.message}`)
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        status: 'success',
        amountFc,
        newBalance,
        message: `Successfully purchased ${amountFc} FC tokens`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (err) {
    console.error('Error in buy-fc-tokens:', err)
    
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
