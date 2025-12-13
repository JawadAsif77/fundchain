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
    const { adminId, campaignId, reason } = body

    if (!adminId || typeof adminId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'adminId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!campaignId || typeof campaignId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'campaignId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1) Verify admin user
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', adminId)
      .single()

    if (adminError || !admin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (admin.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'User is not authorized as admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2) Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (campaign.status === 'failed' || campaign.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, error: `Campaign is already ${campaign.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3) Fetch all confirmed investments
    const { data: investments, error: investmentsError } = await supabase
      .from('investments')
      .select('id, investor_id, amount')
      .eq('campaign_id', campaignId)
      .eq('status', 'confirmed')

    if (investmentsError) {
      console.error('Investments fetch error:', investmentsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch investments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!investments || investments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No confirmed investments to refund',
          refundedCount: 0,
          totalRefund: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4) Calculate total refund
    const totalRefund = investments.reduce((sum, inv) => sum + (inv.amount || 0), 0)

    // 5) Fetch campaign_wallets
    const { data: campaignWallet, error: campaignWalletError } = await supabase
      .from('campaign_wallets')
      .select('escrow_balance_fc, released_fc')
      .eq('campaign_id', campaignId)
      .single()

    if (campaignWalletError || !campaignWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (campaignWallet.escrow_balance_fc < totalRefund) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient escrow balance for refunds',
          available: campaignWallet.escrow_balance_fc,
          required: totalRefund
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6) Fetch platform_wallet
    const { data: platformWallet, error: platformWalletError } = await supabase
      .from('platform_wallet')
      .select('id, balance_fc, locked_fc')
      .single()

    if (platformWalletError || !platformWallet) {
      console.error('Platform wallet fetch error:', platformWalletError)
    }

    if (platformWallet && (platformWallet.locked_fc || 0) < totalRefund) {
      console.warn(`Platform wallet locked_fc (${platformWallet.locked_fc}) less than totalRefund (${totalRefund})`)
    }

    // 7) Process each investment refund
    const refundReason = reason || 'Campaign failed'
    const now = new Date().toISOString()

    for (const investment of investments) {
      // Fetch investor wallet
      const { data: investorWallet, error: walletError } = await supabase
        .from('wallets')
        .select('user_id, balance_fc, locked_fc')
        .eq('user_id', investment.investor_id)
        .single()

      if (walletError || !investorWallet) {
        console.error(`Wallet not found for investor ${investment.investor_id}`)
        continue
      }

      if ((investorWallet.locked_fc || 0) < investment.amount) {
        console.error(`Insufficient locked_fc for investor ${investment.investor_id}`)
        continue
      }

      // Update investor wallet
      const newLockedFc = (investorWallet.locked_fc || 0) - investment.amount
      const newBalanceFc = (investorWallet.balance_fc || 0) + investment.amount

      const { error: updateWalletError } = await supabase
        .from('wallets')
        .update({
          locked_fc: newLockedFc,
          balance_fc: newBalanceFc
        })
        .eq('user_id', investment.investor_id)

      if (updateWalletError) {
        console.error(`Failed to update wallet for investor ${investment.investor_id}:`, updateWalletError)
        continue
      }

      // Update investment record
      const { error: updateInvestmentError } = await supabase
        .from('investments')
        .update({
          status: 'refunded',
          refund_amount: investment.amount,
          refund_reason: refundReason,
          refunded_at: now
        })
        .eq('id', investment.id)

      if (updateInvestmentError) {
        console.error(`Failed to update investment ${investment.id}:`, updateInvestmentError)
      }

      // Insert token_transactions
      const { error: tokenTxError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: investment.investor_id,
          campaign_id: campaignId,
          milestone_id: null,
          amount_fc: investment.amount,
          type: 'refund_fc',
          metadata: {
            refunded_by: adminId,
            investment_id: investment.id,
            reason: refundReason,
            source: 'edge_function',
            function: 'refund-campaign-investors'
          }
        })

      if (tokenTxError) {
        console.error(`Failed to insert token transaction for investor ${investment.investor_id}:`, tokenTxError)
      }

      // Insert transactions
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: investment.investor_id,
          campaign_id: campaignId,
          investment_id: investment.id,
          amount: investment.amount,
          type: 'refund_fc',
          description: `Refund due to campaign failure: ${refundReason}`
        })

      if (txError) {
        console.error(`Failed to insert transaction for investor ${investment.investor_id}:`, txError)
      }
    }

    // 8) Update campaign_wallets
    const newEscrowBalance = campaignWallet.escrow_balance_fc - totalRefund

    const { error: updateCampaignWalletError } = await supabase
      .from('campaign_wallets')
      .update({
        escrow_balance_fc: newEscrowBalance
      })
      .eq('campaign_id', campaignId)

    if (updateCampaignWalletError) {
      console.error('Campaign wallet update error:', updateCampaignWalletError)
    }

    // 9) Update platform_wallet
    if (platformWallet) {
      const newPlatformLockedFc = Math.max((platformWallet.locked_fc || 0) - totalRefund, 0)

      const { error: updatePlatformWalletError } = await supabase
        .from('platform_wallet')
        .update({
          locked_fc: newPlatformLockedFc
        })
        .eq('id', platformWallet.id)

      if (updatePlatformWalletError) {
        console.error('Platform wallet update error:', updatePlatformWalletError)
      }
    }

    // 10) Update campaign status
    const { error: updateCampaignError } = await supabase
      .from('campaigns')
      .update({
        status: 'failed'
      })
      .eq('id', campaignId)

    if (updateCampaignError) {
      console.error('Campaign update error:', updateCampaignError)
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        refundedCount: investments.length,
        totalRefund: totalRefund
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('refund-campaign-investors error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
