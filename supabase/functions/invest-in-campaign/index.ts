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
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase env vars')
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse and validate request body
    const body = await req.json()
    const { userId, campaignId, amount } = body

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!campaignId || typeof campaignId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'campaignId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'amount must be a positive number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1) Validate user exists and has wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_fc, locked_fc')
      .eq('user_id', userId)
      .single()

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'User wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2) Validate campaign exists and is active
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, creator_id, status, current_funding, total_raised, investor_count')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (campaign.status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3) Validate sufficient balance
    if (wallet.balance_fc < amountNum) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient balance',
          available: wallet.balance_fc,
          required: amountNum
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4) Update user wallet (deduct from balance_fc, add to locked_fc)
    const newBalanceFc = wallet.balance_fc - amountNum
    const newLockedFc = (wallet.locked_fc || 0) + amountNum

    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({
        balance_fc: newBalanceFc,
        locked_fc: newLockedFc
      })
      .eq('user_id', userId)

    if (walletUpdateError) {
      console.error('Wallet update failed:', walletUpdateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5) Upsert campaign_wallets (escrow)
    const { data: existingCampaignWallet } = await supabase
      .from('campaign_wallets')
      .select('escrow_balance_fc, released_fc')
      .eq('campaign_id', campaignId)
      .maybeSingle()

    const newEscrowBalance = (existingCampaignWallet?.escrow_balance_fc || 0) + amountNum

    const { data: campaignWallet, error: campaignWalletError } = await supabase
      .from('campaign_wallets')
      .upsert({
        campaign_id: campaignId,
        escrow_balance_fc: newEscrowBalance,
        released_fc: existingCampaignWallet?.released_fc || 0
      })
      .select()
      .single()

    if (campaignWalletError) {
      console.error('Campaign wallet upsert failed:', campaignWalletError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update campaign wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6) Insert investment record
    const { data: investment, error: investmentError } = await supabase
      .from('investments')
      .insert({
        investor_id: userId,
        campaign_id: campaignId,
        amount: amountNum,
        status: 'confirmed',
        investment_date: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (investmentError || !investment) {
      console.error('Investment insert failed:', investmentError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create investment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7) Upsert campaign_investments (aggregated per user per campaign)
    const { data: existingCampaignInvestment } = await supabase
      .from('campaign_investments')
      .select('amount_fc')
      .eq('campaign_id', campaignId)
      .eq('investor_id', userId)
      .maybeSingle()

    const newCampaignInvestmentAmount = (existingCampaignInvestment?.amount_fc || 0) + amountNum

    const { error: campaignInvestmentError } = await supabase
      .from('campaign_investments')
      .upsert({
        campaign_id: campaignId,
        investor_id: userId,
        amount_fc: newCampaignInvestmentAmount
      })

    if (campaignInvestmentError) {
      console.error('Campaign investment upsert failed:', campaignInvestmentError)
    }

    // 8) Upsert campaign_investors (unique investor tracking)
    const { data: existingInvestor } = await supabase
      .from('campaign_investors')
      .select('total_invested, first_investment_at')
      .eq('campaign_id', campaignId)
      .eq('investor_id', userId)
      .maybeSingle()

    const isFirstInvestment = !existingInvestor
    const newTotalInvested = (existingInvestor?.total_invested || 0) + amountNum

    const { error: campaignInvestorError } = await supabase
      .from('campaign_investors')
      .upsert({
        campaign_id: campaignId,
        investor_id: userId,
        total_invested: newTotalInvested,
        first_investment_at: existingInvestor?.first_investment_at || new Date().toISOString(),
        last_investment_at: new Date().toISOString()
      })

    if (campaignInvestorError) {
      console.error('Campaign investor upsert failed:', campaignInvestorError)
    }

    // 9) Update campaigns (current_funding, total_raised, investor_count)
    const newCurrentFunding = (campaign.current_funding || 0) + amountNum
    const newTotalRaised = (campaign.total_raised || 0) + amountNum
    const newInvestorCount = (campaign.investor_count || 0) + (isFirstInvestment ? 1 : 0)

    const { error: campaignUpdateError } = await supabase
      .from('campaigns')
      .update({
        current_funding: newCurrentFunding,
        total_raised: newTotalRaised,
        investor_count: newInvestorCount
      })
      .eq('id', campaignId)

    if (campaignUpdateError) {
      console.error('Campaign update failed:', campaignUpdateError)
    }

    // 10) Insert into transactions
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        investment_id: investment.id,
        amount: amountNum,
        type: 'invest_fc',
        description: `User invested ${amountNum} FC into campaign`
      })

    if (transactionError) {
      console.error('Transaction insert failed:', transactionError)
    }

    // 11) Insert into token_transactions
    const { error: tokenTxError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        milestone_id: null,
        amount_fc: amountNum,
        type: 'invest_fc',
        metadata: {
          source: 'edge_function',
          function: 'invest-in-campaign',
          investment_id: investment.id
        }
      })

    if (tokenTxError) {
      console.error('Token transaction insert failed:', tokenTxError)
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        investment: {
          id: investment.id,
          campaign_id: campaignId,
          investor_id: userId,
          amount: amountNum,
          status: 'confirmed'
        },
        newBalance: {
          balance_fc: newBalanceFc,
          locked_fc: newLockedFc
        },
        campaignWallet: {
          escrow_balance_fc: campaignWallet.escrow_balance_fc,
          released_fc: campaignWallet.released_fc
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('invest-in-campaign error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
