// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calculateAccountAgeDays(createdAt: string): number {
  const now = new Date()
  const accountCreated = new Date(createdAt)
  const diffTime = Math.abs(now.getTime() - accountCreated.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

function getRiskLevel(finalRiskScore: number): string {
  if (finalRiskScore > 0.66) return 'high'
  if (finalRiskScore > 0.33) return 'medium'
  return 'low'
}

function buildKYCDescription(kycData: Record<string, unknown>): string {
  const parts: string[] = []
  parts.push(`Name: ${kycData.legal_name || 'Not provided'}`)
  parts.push(`Nationality: ${kycData.nationality || 'Not provided'}`)
  parts.push(`Occupation: ${kycData.occupation || 'Not provided'}`)
  parts.push(`Source of Funds: ${kycData.source_of_funds || 'Not provided'}`)
  parts.push(`Purpose: ${kycData.purpose_of_platform || 'Not provided'}`)
  parts.push(`ID Type: ${kycData.id_type || 'Not provided'}`)
  parts.push(`PEP Status: ${kycData.pep_status ? 'Yes' : 'No'}`)
  parts.push(`Phone Verified: ${kycData.phone_verified ? 'Yes' : 'No'}`)
  parts.push(`Documents Uploaded: ${kycData.id_document_url ? 'Yes' : 'No'}`)
  return parts.join('. ')
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
    const aiServiceSecret = Deno.env.get('AI_SERVICE_SECRET') ?? ''

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Auth: only admin / customer_support can run KYC analysis ---
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check caller role
    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const allowedRoles = ['admin', 'customer_support']
    if (!allowedRoles.includes(callerProfile?.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: only admin or customer support can trigger KYC analysis' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { verification_id } = body

    if (!verification_id || typeof verification_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'verification_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch KYC verification data
    const { data: verification, error: verificationError } = await supabase
      .from('user_verifications')
      .select('*')
      .eq('id', verification_id)
      .maybeSingle()

    if (verificationError || !verification) {
      return new Response(
        JSON.stringify({ error: 'Verification not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch user account data
    const { data: subjectUser, error: userError } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', verification.user_id)
      .maybeSingle()

    if (userError || !subjectUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accountAgeDays = calculateAccountAgeDays(subjectUser.created_at)

    const { count: campaignCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', verification.user_id)

    const { count: investmentCount } = await supabase
      .from('investments')
      .select('*', { count: 'exact', head: true })
      .eq('investor_id', verification.user_id)
      .eq('status', 'confirmed')

    const pastCampaigns = campaignCount || 0
    const pastInvestments = investmentCount || 0

    // Fetch other approved KYC records for comparison (only non-PII fields)
    const { data: existingKYCs } = await supabase
      .from('user_verifications')
      .select('legal_name, nationality, occupation, source_of_funds, purpose_of_platform, id_type, pep_status, phone_verified, id_document_url')
      .neq('id', verification_id)
      .eq('verification_status', 'approved')
      .limit(50)

    const kycDescription = buildKYCDescription(verification)
    const existingDescriptions = existingKYCs?.map(k => buildKYCDescription(k)).filter(Boolean) || []

    const aiRequestBody = {
      description: kycDescription,
      existing_descriptions: existingDescriptions,
      wallet_age_days: accountAgeDays,
      past_investments: pastInvestments + pastCampaigns,
    }

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

    let aiResult
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

    const riskLevel = getRiskLevel(aiResult.final_risk_score)

    const { error: updateError } = await supabase
      .from('user_verifications')
      .update({
        risk_level: riskLevel,
        metadata: {
          ...verification.metadata,
          ai_analysis: {
            ml_scam_score: aiResult.ml_scam_score,
            plagiarism_score: aiResult.plagiarism_score,
            wallet_risk_score: aiResult.wallet_risk_score,
            final_risk_score: aiResult.final_risk_score,
            analyzed_at: new Date().toISOString(),
            account_age_days: accountAgeDays,
            past_activity: pastCampaigns + pastInvestments,
          },
        },
      })
      .eq('id', verification_id)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update verification with risk scores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: user.id,
      action: 'KYC_ANALYSIS_TRIGGERED',
      target_type: 'user_verification',
      target_id: verification_id,
      metadata: { risk_level: riskLevel, final_risk_score: aiResult.final_risk_score },
    })

    return new Response(
      JSON.stringify({
        success: true,
        verification_id,
        risk_level: riskLevel,
        scores: {
          ml_scam_score: aiResult.ml_scam_score,
          plagiarism_score: aiResult.plagiarism_score,
          wallet_risk_score: aiResult.wallet_risk_score,
          final_risk_score: aiResult.final_risk_score,
        },
        metadata: {
          account_age_days: accountAgeDays,
          past_activity: pastCampaigns + pastInvestments,
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
