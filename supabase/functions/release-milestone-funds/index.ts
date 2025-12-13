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
    const { adminId, campaignId, milestoneId, amountFc, notes } = body

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

    if (!milestoneId || typeof milestoneId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'milestoneId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const amount = Number(amountFc)
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'amountFc must be a positive number' }),
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
      .select('id, creator_id, status')
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
        JSON.stringify({ success: false, error: `Cannot release funds for ${campaign.status} campaign` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3) Fetch milestone
    const { data: milestone, error: milestoneError } = await supabase
      .from('milestones')
      .select('id, campaign_id, title')
      .eq('id', milestoneId)
      .single()

    if (milestoneError || !milestone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Milestone not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (milestone.campaign_id !== campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Milestone does not belong to specified campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4) Fetch campaign_wallets
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

    if (campaignWallet.escrow_balance_fc < amount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient escrow balance',
          available: campaignWallet.escrow_balance_fc,
          required: amount
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5) Fetch platform_wallet
    const { data: platformWallet, error: platformWalletError } = await supabase
      .from('platform_wallet')
      .select('id, balance_fc, locked_fc')
      .single()

    if (platformWalletError || !platformWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Platform wallet not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6) Fetch or create creator wallet
    let { data: creatorWallet, error: creatorWalletError } = await supabase
      .from('wallets')
      .select('user_id, balance_fc, locked_fc')
      .eq('user_id', campaign.creator_id)
      .maybeSingle()

    if (creatorWalletError) {
      console.error('Creator wallet fetch error:', creatorWalletError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch creator wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!creatorWallet) {
      // Create wallet for creator
      const { data: newWallet, error: createWalletError } = await supabase
        .from('wallets')
        .insert({
          user_id: campaign.creator_id,
          balance_fc: 0,
          locked_fc: 0
        })
        .select()
        .single()

      if (createWalletError || !newWallet) {
        console.error('Creator wallet creation error:', createWalletError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create creator wallet' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      creatorWallet = newWallet
    }

    // 7) Perform updates

    // Update campaign_wallets
    const newEscrowBalance = campaignWallet.escrow_balance_fc - amount
    const newReleasedFc = (campaignWallet.released_fc || 0) + amount

    const { data: updatedCampaignWallet, error: updateCampaignWalletError } = await supabase
      .from('campaign_wallets')
      .update({
        escrow_balance_fc: newEscrowBalance,
        released_fc: newReleasedFc
      })
      .eq('campaign_id', campaignId)
      .select()
      .single()

    if (updateCampaignWalletError) {
      console.error('Campaign wallet update error:', updateCampaignWalletError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update campaign wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update platform_wallet (decrease locked_fc)
    const newPlatformLockedFc = Math.max((platformWallet.locked_fc || 0) - amount, 0)

    const { error: updatePlatformWalletError } = await supabase
      .from('platform_wallet')
      .update({
        locked_fc: newPlatformLockedFc
      })
      .eq('id', platformWallet.id)

    if (updatePlatformWalletError) {
      console.error('Platform wallet update error:', updatePlatformWalletError)
    }

    // Update creator wallet (increase balance_fc)
    const newCreatorBalanceFc = (creatorWallet!.balance_fc || 0) + amount

    const { data: updatedCreatorWallet, error: updateCreatorWalletError } = await supabase
      .from('wallets')
      .update({
        balance_fc: newCreatorBalanceFc
      })
      .eq('user_id', campaign.creator_id)
      .select()
      .single()

    if (updateCreatorWalletError) {
      console.error('Creator wallet update error:', updateCreatorWalletError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update creator wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update milestone
    const now = new Date().toISOString()
    const completionNotes = notes || 'Milestone funds released'

    const { data: updatedMilestone, error: updateMilestoneError } = await supabase
      .from('milestones')
      .update({
        is_completed: true,
        completion_date: now,
        completion_notes: completionNotes
      })
      .eq('id', milestoneId)
      .select()
      .single()

    if (updateMilestoneError) {
      console.error('Milestone update error:', updateMilestoneError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update milestone' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert token_transactions
    const { error: tokenTxError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: campaign.creator_id,
        campaign_id: campaignId,
        milestone_id: milestoneId,
        amount_fc: amount,
        type: 'release_fc',
        metadata: {
          approved_by: adminId,
          source: 'edge_function',
          function: 'release-milestone-funds'
        }
      })

    if (tokenTxError) {
      console.error('Token transaction insert error:', tokenTxError)
    }

    // Insert transactions
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: campaign.creator_id,
        campaign_id: campaignId,
        amount: amount,
        type: 'release_fc',
        description: `Milestone funds released to creator (${milestone.title})`
      })

    if (txError) {
      console.error('Transaction insert error:', txError)
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        campaignWallet: {
          escrow_balance_fc: updatedCampaignWallet.escrow_balance_fc,
          released_fc: updatedCampaignWallet.released_fc
        },
        creatorWallet: {
          balance_fc: updatedCreatorWallet.balance_fc,
          locked_fc: updatedCreatorWallet.locked_fc
        },
        milestone: {
          id: updatedMilestone.id,
          is_completed: updatedMilestone.is_completed,
          completion_date: updatedMilestone.completion_date
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('release-milestone-funds error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
