// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfigured' }),
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
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const amountFc = Number(body?.amountFc)

    if (!amountFc || amountFc <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'amountFc must be a positive number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('id, role, wallet_address')
      .eq('id', user.id)
      .single()

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ success: false, error: 'Creator profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (creator.role !== 'creator') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only creators can withdraw funds' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!creator.wallet_address) {
      return new Response(
        JSON.stringify({ success: false, error: 'No Solana wallet address linked to your profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: creatorWallet, error: walletError } = await supabase
      .from('wallets')
      .select('user_id, balance_fc, locked_fc')
      .eq('user_id', creator.id)
      .single()

    if (walletError || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Creator wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (Number(creatorWallet.balance_fc) < amountFc) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient FC balance',
          available: Number(creatorWallet.balance_fc),
          requested: amountFc
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const fcPerSol = Number(Deno.env.get('FC_PER_SOL') ?? '100')
    if (!fcPerSol || fcPerSol <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid FC_PER_SOL configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const amountSol = Number((amountFc / fcPerSol).toFixed(6))
    const txSignature = `pending-${crypto.randomUUID()}`
    const newBalanceFc = Number(creatorWallet.balance_fc) - amountFc

    const { error: updateWalletError } = await supabase
      .from('wallets')
      .update({ balance_fc: newBalanceFc })
      .eq('user_id', creator.id)

    if (updateWalletError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update creator wallet balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rollbackWallet = async () => {
      await supabase
        .from('wallets')
        .update({ balance_fc: Number(creatorWallet.balance_fc) })
        .eq('user_id', creator.id)
    }

    const metadata = {
      destination_wallet: creator.wallet_address,
      initiated_by: creator.id,
      exchange_rate_fc_per_sol: fcPerSol,
      settlement: 'manual',
      source: 'edge_function',
      function: 'withdraw-fc-to-sol'
    }

    const { error: fundTxError } = await supabase
      .from('fund_transactions')
      .insert({
        user_id: creator.id,
        amount_fc: amountFc,
        amount_sol: amountSol,
        solana_tx_signature: txSignature,
        status: 'pending',
        metadata
      })

    if (fundTxError) {
      await rollbackWallet()
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create fund transaction record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: tokenTxError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: creator.id,
        amount_fc: amountFc,
        type: 'withdraw_fc',
        metadata: {
          ...metadata,
          amount_sol: amountSol,
          solana_tx_signature: txSignature,
          status: 'pending'
        }
      })

    if (tokenTxError) {
      await rollbackWallet()
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create token transaction record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: creator.id,
        amount: amountFc,
        type: 'withdraw_fc',
        description: `Creator withdrew ${amountFc} FC to Solana wallet (${amountSol} SOL equivalent)`
      })

    if (txError) {
      await rollbackWallet()
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create transaction history record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        amountFc,
        amountSol,
        exchangeRate: fcPerSol,
        destinationWallet: creator.wallet_address,
        status: 'pending',
        txSignature,
        wallet: {
          balance_fc: newBalanceFc,
          locked_fc: Number(creatorWallet.locked_fc || 0)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('withdraw-fc-to-sol error:', err)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
