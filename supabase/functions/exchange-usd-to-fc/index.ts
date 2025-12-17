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
    // 1. FIXED: Handle potential null Authorization header
    const authHeader = req.headers.get('Authorization')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )

    // 2. FIXED: Safe JSON parsing
    const { amountUsd } = await req.json()

    if (!amountUsd || amountUsd <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be a positive number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const exchangeRate = 1 
    const tokenAmount = amountUsd * exchangeRate

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('User not authenticated')

    // 3. Update User Balance
    const { data: profile } = await supabaseClient
      .from('users')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const currentBalance = Number(profile?.preferences?.wallet_balance || 0)
    const newBalance = currentBalance + tokenAmount

    const { error: updateError } = await supabaseClient
      .from('users')
      .update({
        preferences: { ...profile?.preferences, wallet_balance: newBalance },
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    // 4. Log Transaction
    await supabaseClient.from('token_transactions').insert({
      user_id: user.id,
      amount: tokenAmount,
      token_symbol: 'FC',
      transaction_type: 'buy',
      status: 'completed',
      description: `Bought ${tokenAmount} FC with ${amountUsd} USD (Dummy)`
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully bought ${tokenAmount} FC`,
        newBalance 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    // 5. FIXED: TypeScript "Object is of type 'unknown'" error
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})