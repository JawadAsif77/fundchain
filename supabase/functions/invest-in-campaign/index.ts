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
    const campaignId = body.campaignId
    const amountFc = body.amountFc

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

    if (!campaignId || typeof campaignId !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request: campaignId is required and must be a string' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!amountFc || typeof amountFc !== 'number' || amountFc <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request: amountFc is required and must be a positive number' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 1: Fetch user wallet
    const { data: userWallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_fc, locked_fc')
      .eq('user_id', userId)
      .single()

    if (walletError) {
      throw new Error(`Failed to fetch user wallet: ${walletError.message}`)
    }

    // Step 2: Ensure sufficient balance
    if (userWallet.balance_fc < amountFc) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          availableBalance: userWallet.balance_fc,
          requiredAmount: amountFc
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 3: Fetch campaign to verify it's active
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, status, total_raised')
      .eq('id', campaignId)
      .single()

    if (campaignError) {
      throw new Error(`Failed to fetch campaign: ${campaignError.message}`)
    }

    if (campaign.status !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: 'Campaign is not active',
          campaignStatus: campaign.status
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 4: Update user wallet - deduct from balance_fc and add to locked_fc
    const newBalance = userWallet.balance_fc - amountFc
    const newLockedBalance = (userWallet.locked_fc || 0) + amountFc

    const { error: updateWalletError } = await supabase
      .from('wallets')
      .update({ 
        balance_fc: newBalance,
        locked_fc: newLockedBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateWalletError) {
      throw new Error(`Failed to update user wallet: ${updateWalletError.message}`)
    }

    // Step 5: Insert row into campaign_investments
    const { error: investmentError } = await supabase
      .from('campaign_investments')
      .insert({
        campaign_id: campaignId,
        investor_id: userId,
        amount_fc: amountFc
      })

    if (investmentError) {
      throw new Error(`Failed to create campaign investment: ${investmentError.message}`)
    }

    // Step 6: Insert/update investor in campaign_investors
    // First check if investor already exists for this campaign
    const { data: existingInvestor, error: investorCheckError } = await supabase
      .from('campaign_investors')
      .select('total_invested_fc')
      .eq('campaign_id', campaignId)
      .eq('investor_id', userId)
      .single()

    if (investorCheckError && investorCheckError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new Error(`Failed to check existing investor: ${investorCheckError.message}`)
    }

    if (existingInvestor) {
      // Update existing investor
      const newTotalInvested = (existingInvestor.total_invested_fc || 0) + amountFc
      const { error: updateInvestorError } = await supabase
        .from('campaign_investors')
        .update({ 
          total_invested_fc: newTotalInvested,
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', campaignId)
        .eq('investor_id', userId)

      if (updateInvestorError) {
        throw new Error(`Failed to update campaign investor: ${updateInvestorError.message}`)
      }
    } else {
      // Insert new investor
      const { error: insertInvestorError } = await supabase
        .from('campaign_investors')
        .insert({
          campaign_id: campaignId,
          investor_id: userId,
          total_invested_fc: amountFc
        })

      if (insertInvestorError) {
        throw new Error(`Failed to insert campaign investor: ${insertInvestorError.message}`)
      }
    }

    // Step 7: Update campaigns.total_raised
    const newTotalRaised = (campaign.total_raised || 0) + amountFc

    const { error: updateCampaignError } = await supabase
      .from('campaigns')
      .update({ 
        total_raised: newTotalRaised,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    if (updateCampaignError) {
      throw new Error(`Failed to update campaign total_raised: ${updateCampaignError.message}`)
    }

    // Step 8: Insert transaction record into token_transactions
    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        amount_fc: -amountFc, // Negative because it's being locked/spent
        type: 'INVEST',
        metadata: {
          campaign_id: campaignId,
          timestamp: new Date().toISOString()
        }
      })

    if (transactionError) {
      throw new Error(`Failed to create transaction record: ${transactionError.message}`)
    }

    // Step 9: Return success response with updated wallet info
    return new Response(
      JSON.stringify({ 
        status: 'success',
        newBalance,
        lockedBalance: newLockedBalance,
        message: `Successfully invested ${amountFc} FC tokens in campaign`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (err) {
    console.error('Error in invest-in-campaign:', err)
    
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
