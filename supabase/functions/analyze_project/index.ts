// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================================
// Helper function to calculate wallet age in days
// ============================================================================
function calculateWalletAgeDays(createdAt: string): number {
  const now = new Date()
  const walletCreated = new Date(createdAt)
  const diffTime = Math.abs(now.getTime() - walletCreated.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// ============================================================================
// Helper function to determine risk level from final score
// ============================================================================
function getRiskLevel(finalRiskScore: number): string {
  if (finalRiskScore > 0.66) return 'HIGH'
  if (finalRiskScore > 0.33) return 'MEDIUM'
  return 'LOW'
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0
  if (score < 0) return 0
  if (score > 1) return 1
  return score
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const aiServiceUrl = Deno.env.get('AI_SERVICE_URL') ?? 'https://fundchain-ai-service.onrender.com'

    if (!aiServiceUrl) {
      throw new Error('AI_SERVICE_URL environment variable is required')
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ============================================================================
    // 1. Parse request body
    // ============================================================================
    const body = await req.json()
    const { campaign_id, analysis_mode } = body
    const analysisMode = analysis_mode === 'onchain_only' ? 'onchain_only' : 'full'

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: 'campaign_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Analyzing campaign: ${campaign_id}`)

    // ============================================================================
    // 2. Fetch campaign data
    // ============================================================================
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, creator_id, created_at, description, ml_scam_score, plagiarism_score, wallet_risk_score, final_risk_score')
      .eq('id', campaign_id)
      .maybeSingle()

    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError)
      return new Response(
        JSON.stringify({ 
          error: 'Campaign not found',
          details: campaignError?.message 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Campaign found: ${campaign.id}`)

    // ============================================================================
    // 3. Fetch creator user data for wallet age
    // ============================================================================
    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('created_at, wallet_address')
      .eq('id', campaign.creator_id)
      .single()

    if (creatorError || !creator) {
      console.error('Creator fetch error:', creatorError)
      return new Response(
        JSON.stringify({ 
          error: 'Creator not found',
          details: creatorError?.message 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // ============================================================================
    // 3.5 Invoke on-chain wallet analysis
    // ============================================================================
    let onChainAnalysis = {
      riskScore: 50,
      explanation: 'On-chain analysis could not be performed.',
      details: {},
    }

    if (creator.wallet_address) {
      try {
        const walletAnalysisResponse = await supabase.functions.invoke('analyze-wallet-footprint', {
          body: { walletAddress: creator.wallet_address },
        })

        if (walletAnalysisResponse.error) {
          console.error('On-chain analysis invocation error:', walletAnalysisResponse.error)
          onChainAnalysis.explanation = 'Error invoking on-chain analysis function.'
        } else {
          onChainAnalysis = walletAnalysisResponse.data
          console.log('On-chain analysis successful:', onChainAnalysis)
        }
      } catch (e) {
        console.error('Critical error during on-chain analysis invocation:', e)
        onChainAnalysis.explanation = 'A critical error occurred during on-chain analysis.'
      }
    } else {
      console.warn(`Creator ${campaign.creator_id} has no wallet address for on-chain analysis.`)
      onChainAnalysis.explanation = 'No wallet address provided for on-chain analysis.'
    }

    // ============================================================================
    // 4. Fetch creator wallet data
    // ============================================================================
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_fc, locked_fc, updated_at')
      .eq('user_id', campaign.creator_id)
      .maybeSingle()

    if (walletError || !wallet) {
      console.error('Wallet fetch error:', walletError)
      return new Response(
        JSON.stringify({ 
          error: 'Creator wallet not found',
          details: walletError?.message 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // ============================================================================
    // 5. Compute wallet age in days using creator account age
    // ============================================================================
    const walletAgeDays = calculateWalletAgeDays(creator.created_at)
    console.log(`Wallet age: ${walletAgeDays} days`)

    // ============================================================================
    // 6. Count creator's past investments
    // ============================================================================
    const { count: pastInvestments, error: investmentCountError } = await supabase
      .from('investments')
      .select('*', { count: 'exact', head: true })
      .eq('investor_id', campaign.creator_id)
      .eq('status', 'confirmed')

    if (investmentCountError) {
      console.error('Investment count error:', investmentCountError)
    }

    console.log(`Past investments: ${pastInvestments || 0}`)

    let aiResult
    let descriptionsChecked = 0

    if (analysisMode === 'full') {
      // ============================================================================
      // 7. Fetch last 20 campaign descriptions for plagiarism check
      // ============================================================================
      const { data: existingCampaigns, error: existingError } = await supabase
        .from('campaigns')
        .select('description')
        .neq('id', campaign_id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (existingError) {
        console.error('Error fetching existing campaigns:', existingError)
      }

      const existingDescriptions = existingCampaigns?.map(c => c.description).filter(Boolean) || []
      descriptionsChecked = existingDescriptions.length
      console.log(`Found ${existingDescriptions.length} existing descriptions for plagiarism check`)

      // ============================================================================
      // 8. Build AI service request body
      // ============================================================================
      const aiRequestBody = {
        description: campaign.description || '',
        existing_descriptions: existingDescriptions,
        wallet_age_days: walletAgeDays,
        past_investments: pastInvestments || 0
      }

      console.log('Sending request to AI service...')

      // ============================================================================
      // 9. Send POST request to AI microservice
      // ============================================================================
      const aiResponse = await fetch(`${aiServiceUrl}/analyze-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiRequestBody)
      })

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text()
        console.error('AI service error:', errorText)
        return new Response(
          JSON.stringify({
            error: 'AI service request failed',
            status: aiResponse.status,
            details: errorText
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // ============================================================================
      // 10. Parse AI service response
      // ============================================================================
      try {
        aiResult = await aiResponse.json()
      } catch (parseError) {
        const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError)
        console.error('Failed to parse AI response:', parseError)
        return new Response(
          JSON.stringify({
            error: 'Failed to parse AI service response',
            details: parseErrorMessage
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('AI analysis complete:', aiResult)

      // Validate AI response structure
      if (
        typeof aiResult.ml_scam_score !== 'number' ||
        typeof aiResult.plagiarism_score !== 'number' ||
        typeof aiResult.wallet_risk_score !== 'number' ||
        typeof aiResult.final_risk_score !== 'number'
      ) {
        return new Response(
          JSON.stringify({
            error: 'Invalid AI service response format',
            received: aiResult
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      const hasExistingAiComponents =
        typeof campaign.ml_scam_score === 'number' &&
        typeof campaign.plagiarism_score === 'number' &&
        typeof campaign.wallet_risk_score === 'number'

      const aiCompositeScore = hasExistingAiComponents
        ? clampScore(
            0.6 * campaign.ml_scam_score +
            0.25 * campaign.plagiarism_score +
            0.15 * campaign.wallet_risk_score
          )
        : clampScore(typeof campaign.final_risk_score === 'number' ? campaign.final_risk_score : 0.5)

      aiResult = {
        ml_scam_score: typeof campaign.ml_scam_score === 'number' ? campaign.ml_scam_score : 0,
        plagiarism_score: typeof campaign.plagiarism_score === 'number' ? campaign.plagiarism_score : 0,
        wallet_risk_score: typeof campaign.wallet_risk_score === 'number' ? campaign.wallet_risk_score : 0,
        final_risk_score: aiCompositeScore,
      }

      console.log('On-chain only mode: reusing existing AI components and refreshing on-chain score')
    }

    // ============================================================================
    // 11. Compute risk level
    // ============================================================================
    const blendedRiskScore =
      (aiResult.final_risk_score * 0.5) + ((onChainAnalysis.riskScore / 100) * 0.5)
    const riskLevel = getRiskLevel(blendedRiskScore)
    console.log(`Risk level determined: ${riskLevel}`)

    // ============================================================================
    // 12. Update campaigns table with risk scores
    // ============================================================================
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        ml_scam_score: aiResult.ml_scam_score,
        plagiarism_score: aiResult.plagiarism_score,
        wallet_risk_score: aiResult.wallet_risk_score,
        final_risk_score: blendedRiskScore,
        risk_level: riskLevel,
        analyzed_at: new Date().toISOString(),
        onchain_risk_details: onChainAnalysis,
      })
      .eq('id', campaign_id)

    if (updateError) {
      console.error('Campaign update error:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update campaign with risk scores',
          details: updateError.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Campaign ${campaign_id} updated successfully`)

    // ============================================================================
    // 13. Return success response with all scores
    // ============================================================================
    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign_id,
        analysis: {
          analysis_mode: analysisMode,
          ml_scam_score: aiResult.ml_scam_score,
          plagiarism_score: aiResult.plagiarism_score,
          wallet_risk_score: aiResult.wallet_risk_score,
          on_chain_risk_score: onChainAnalysis.riskScore,
          final_risk_score: blendedRiskScore,
          risk_level: riskLevel,
        },
        metadata: {
          wallet_age_days: walletAgeDays,
          past_investments: pastInvestments || 0,
          descriptions_checked: descriptionsChecked,
          analyzed_at: new Date().toISOString()
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage,
        stack: errorStack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
