// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request
    const body = await req.json()
    const { userId, campaignId, amountFc } = body

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'userId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!campaignId || typeof campaignId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'campaignId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!amountFc || typeof amountFc !== 'number' || amountFc <= 0) {
      return new Response(
        JSON.stringify({ error: 'amountFc must be a positive number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1) Check wallet balance
    const walletRes = await supabase
      .from('wallets')
      .select('balance_fc, locked_fc')
      .eq('user_id', userId)
      .single()

    if (walletRes.error) {
      throw new Error(`Failed to fetch wallet: ${walletRes.error.message}`)
    }

    const wallet = walletRes.data
    if (!wallet || wallet.balance_fc < amountFc) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient balance',
          available: wallet?.balance_fc || 0,
          required: amountFc
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2) Move FC from balance to locked
    const newBalance = wallet.balance_fc - amountFc
    const newLocked = (wallet.locked_fc || 0) + amountFc

    const updateRes = await supabase
      .from('wallets')
      .update({ balance_fc: newBalance, locked_fc: newLocked })
      .eq('user_id', userId)

    if (updateRes.error) {
      throw new Error(`Failed to update wallet: ${updateRes.error.message}`)
    }

    // 3) Create investment record (status = 'pending')
    const investRes = await supabase
      .from('investments')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        amount_fc: amountFc,
        status: 'pending'
      })

    if (investRes.error) {
      throw new Error(`Failed to create investment: ${investRes.error.message}`)
    }

    // 4) Log transaction
    const txRes = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        amount_fc: amountFc,
        type: 'invest_fc',
        metadata: {
          campaign_id: campaignId,
          timestamp: new Date().toISOString()
        }
      })

    if (txRes.error) {
      throw new Error(`Failed to log transaction: ${txRes.error.message}`)
    }

    // Success
    return new Response(
      JSON.stringify({
        success: true,
        balanceFc: newBalance,
        lockedFc: newLocked,
        investmentAmount: amountFc
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('invest-in-campaign error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
