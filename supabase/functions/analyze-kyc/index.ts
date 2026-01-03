// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to calculate account age in days
function calculateAccountAgeDays(createdAt: string): number {
  const now = new Date()
  const accountCreated = new Date(createdAt)
  const diffTime = Math.abs(now.getTime() - accountCreated.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Helper function to determine risk level from final score
function getRiskLevel(finalRiskScore: number): string {
  if (finalRiskScore > 0.66) return 'high'
  if (finalRiskScore > 0.33) return 'medium'
  return 'low'
}

// Build a text description from KYC data for AI analysis
function buildKYCDescription(kycData: any): string {
  const parts = []
  
  parts.push(`Name: ${kycData.legal_name || 'Not provided'}`)
  parts.push(`Email: ${kycData.legal_email || 'Not provided'}`)
  parts.push(`Nationality: ${kycData.nationality || 'Not provided'}`)
  parts.push(`Occupation: ${kycData.occupation || 'Not provided'}`)
  parts.push(`Source of Funds: ${kycData.source_of_funds || 'Not provided'}`)
  parts.push(`Purpose: ${kycData.purpose_of_platform || 'Not provided'}`)
  
  if (kycData.legal_address) {
    parts.push(`Address: ${kycData.legal_address.line1}, ${kycData.legal_address.city}, ${kycData.legal_address.country}`)
  }
  
  parts.push(`ID Type: ${kycData.id_type || 'Not provided'}`)
  parts.push(`PEP Status: ${kycData.pep_status ? 'Yes' : 'No'}`)
  parts.push(`Phone Verified: ${kycData.phone_verified ? 'Yes' : 'No'}`)
  parts.push(`Documents Uploaded: ${kycData.id_document_url ? 'Yes' : 'No'}`)
  
  return parts.join('. ')
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

    // Parse request body
    const body = await req.json()
    const { verification_id } = body

    if (!verification_id) {
      return new Response(
        JSON.stringify({ error: 'verification_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Analyzing KYC verification: ${verification_id}`)

    // Fetch KYC verification data
    const { data: verification, error: verificationError } = await supabase
      .from('user_verifications')
      .select('*')
      .eq('id', verification_id)
      .maybeSingle()

    if (verificationError || !verification) {
      console.error('Verification fetch error:', verificationError)
      return new Response(
        JSON.stringify({ 
          error: 'Verification not found',
          details: verificationError?.message 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Verification found for user: ${verification.user_id}`)

    // Fetch user account data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', verification.user_id)
      .maybeSingle()

    if (userError || !user) {
      console.error('User fetch error:', userError)
      return new Response(
        JSON.stringify({ 
          error: 'User not found',
          details: userError?.message 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const accountAgeDays = calculateAccountAgeDays(user.created_at)
    console.log(`Account age: ${accountAgeDays} days`)

    // Check if user has any campaigns (creators with campaigns are less risky)
    const { count: campaignCount, error: campaignCountError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', verification.user_id)

    if (campaignCountError) {
      console.error('Campaign count error:', campaignCountError)
    }

    const pastCampaigns = campaignCount || 0
    console.log(`Past campaigns: ${pastCampaigns}`)

    // Check if user has any investments (investors with history are less risky)
    const { count: investmentCount, error: investmentCountError } = await supabase
      .from('investments')
      .select('*', { count: 'exact', head: true })
      .eq('investor_id', verification.user_id)
      .eq('status', 'confirmed')

    if (investmentCountError) {
      console.error('Investment count error:', investmentCountError)
    }

    const pastInvestments = investmentCount || 0
    console.log(`Past investments: ${pastInvestments}`)

    // Fetch other KYC submissions for comparison (to detect duplicate/suspicious patterns)
    const { data: existingKYCs, error: existingError } = await supabase
      .from('user_verifications')
      .select('legal_name, legal_email, phone, legal_address')
      .neq('id', verification_id)
      .eq('verification_status', 'approved')
      .limit(50)

    if (existingError) {
      console.error('Error fetching existing KYCs:', existingError)
    }

    // Build descriptions for comparison
    const kycDescription = buildKYCDescription(verification)
    const existingDescriptions = existingKYCs?.map(k => buildKYCDescription(k)).filter(Boolean) || []
    console.log(`Found ${existingDescriptions.length} existing KYCs for comparison`)

    // Build AI service request body (reusing campaign analysis structure)
    const aiRequestBody = {
      description: kycDescription,
      existing_descriptions: existingDescriptions,
      wallet_age_days: accountAgeDays,
      past_investments: pastInvestments + pastCampaigns // Combined activity score
    }

    console.log('Sending request to AI service...')

    // Send POST request to AI microservice
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

    // Parse AI service response
    let aiResult
    try {
      aiResult = await aiResponse.json()
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse AI service response',
          details: parseError.message
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

    const riskLevel = getRiskLevel(aiResult.final_risk_score)

    // Update user_verifications table with risk analysis
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
            past_activity: pastCampaigns + pastInvestments
          }
        }
      })
      .eq('id', verification_id)

    if (updateError) {
      console.error('Failed to update verification with risk scores:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update verification with risk scores',
          details: updateError.message 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Successfully updated verification with AI risk analysis')

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        verification_id: verification_id,
        risk_level: riskLevel,
        scores: {
          ml_scam_score: aiResult.ml_scam_score,
          plagiarism_score: aiResult.plagiarism_score,
          wallet_risk_score: aiResult.wallet_risk_score,
          final_risk_score: aiResult.final_risk_score
        },
        metadata: {
          account_age_days: accountAgeDays,
          past_activity: pastCampaigns + pastInvestments
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
