// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calculateWalletAgeDays(createdAt: string): number {
  const now = new Date()
  const walletCreated = new Date(createdAt)
  const diffTime = Math.abs(now.getTime() - walletCreated.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const aiServiceUrl = Deno.env.get('AI_SERVICE_URL') ?? 'https://fundchain-ai-service.onrender.com'
    // Secret shared between this function and the AI service
    const aiServiceSecret = Deno.env.get('AI_SERVICE_SECRET') ?? ''

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Auth: only admin can trigger risk analysis ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the caller is an admin
    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: only admins can trigger risk analysis' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { campaign_id, analysis_mode } = body
    const analysisMode = analysis_mode === 'onchain_only' ? 'onchain_only' : 'full'

    if (!campaign_id || typeof campaign_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'campaign_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, creator_id, created_at, description, ml_scam_score, plagiarism_score, wallet_risk_score, final_risk_score')
      .eq('id', campaign_id)
      .maybeSingle()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch creator user data
    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('created_at, wallet_address')
      .eq('id', campaign.creator_id)
      .single()

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Invoke on-chain wallet analysis
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
        if (!walletAnalysisResponse.error) {
          onChainAnalysis = walletAnalysisResponse.data
        }
      } catch (_e) {
        // Non-critical — continue with default
      }
    }

    // Fetch creator wallet data
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance_fc, locked_fc, updated_at')
      .eq('user_id', campaign.creator_id)
      .maybeSingle()

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: 'Creator wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const walletAgeDays = calculateWalletAgeDays(creator.created_at)

    // Count creator's past investments
    const { count: pastInvestments } = await supabase
      .from('investments')
      .select('*', { count: 'exact', head: true })
      .eq('investor_id', campaign.creator_id)
      .eq('status', 'confirmed')

    let aiResult
    let descriptionsChecked = 0

    if (analysisMode === 'full') {
      // Fetch last 20 campaign descriptions for plagiarism check
      const { data: existingCampaigns } = await supabase
        .from('campaigns')
        .select('description')
        .neq('id', campaign_id)
        .order('created_at', { ascending: false })
        .limit(20)

      const existingDescriptions = existingCampaigns?.map(c => c.description).filter(Boolean) || []
      descriptionsChecked = existingDescriptions.length

      const aiRequestBody = {
        description: campaign.description || '',
        existing_descriptions: existingDescriptions,
        wallet_age_days: walletAgeDays,
        past_investments: pastInvestments || 0,
      }

      // Call AI service with shared secret header
      const aiHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (aiServiceSecret) {
        aiHeaders['x-ai-service-secret'] = aiServiceSecret
      }

      const aiResponse = await fetch(`${aiServiceUrl}/analyze-project`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify(aiRequestBody),
      })

      if (!aiResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'AI service request failed' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        aiResult = await aiResponse.json()
      } catch (_parseError) {
        return new Response(
          JSON.stringify({ error: 'Failed to parse AI service response' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (
        typeof aiResult.ml_scam_score !== 'number' ||
        typeof aiResult.plagiarism_score !== 'number' ||
        typeof aiResult.wallet_risk_score !== 'number' ||
        typeof aiResult.final_risk_score !== 'number'
      ) {
        return new Response(
          JSON.stringify({ error: 'Invalid AI service response format' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        ml_scam_score: campaign.ml_scam_score ?? 0,
        plagiarism_score: campaign.plagiarism_score ?? 0,
        wallet_risk_score: campaign.wallet_risk_score ?? 0,
        final_risk_score: aiCompositeScore,
      }
    }

    const blendedRiskScore =
      (aiResult.final_risk_score * 0.5) + ((onChainAnalysis.riskScore / 100) * 0.5)
    const riskLevel = getRiskLevel(blendedRiskScore)

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
      return new Response(
        JSON.stringify({ error: 'Failed to update campaign with risk scores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: 'RISK_ANALYSIS_TRIGGERED',
      target_type: 'campaign',
      target_id: campaign_id,
      metadata: { analysis_mode: analysisMode, risk_level: riskLevel, final_risk_score: blendedRiskScore },
    })

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id,
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
          analyzed_at: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (_error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
