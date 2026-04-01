// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import {
  RECOMMENDATION_WEIGHTS,
  getRiskValue,
  passesRiskFilter,
  scoreRisk,
  scoreCategory,
  scoreRegion,
  scorePopularity,
  type RiskLevel,
} from './scoring.ts'
import { buildRecommendationExplanation } from './explain.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================================
// Types
// ============================================================================
type FundingStage = 'early' | 'mid' | 'late'

interface Filters {
  category_ids?: string[]
  region?: string
  funding_stage?: FundingStage
  max_risk_level?: RiskLevel
}

interface RequestBody {
  filters?: Filters
  limit?: number
}

interface Campaign {
  id: string
  title: string
  category_id: string
  location: string | null
  risk_level: RiskLevel | null
  final_risk_score: number | null
  status: string
  funding_goal: number
  current_funding: number
  investor_count?: number
  categories?: { name: string } | { name: string }[]
}

interface UserPreferences {
  preferred_categories?: string[]
  preferred_regions?: string[]
  risk_tolerance?: RiskLevel
}

// ============================================================================
// Helper: Get funding stage from progress percentage
// ============================================================================
function getFundingStage(currentFunding: number, fundingGoal: number): FundingStage {
  if (fundingGoal === 0) return 'early'
  const progress = currentFunding / fundingGoal
  if (progress < 0.33) return 'early'
  if (progress < 0.66) return 'mid'
  return 'late'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ============================================================================
    // 1. Initialize Supabase client
    // ============================================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // ============================================================================
    // 2. Get authenticated user from JWT using getUser with the token
    // ============================================================================
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized - invalid token',
          details: authError?.message || 'No user found',
          debug: {
            authHeader: authHeader?.substring(0, 50) + '...',
            errorCode: authError?.code,
            errorStatus: authError?.status
          }
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Generating recommendations for user: ${user.id}`)

    // ============================================================================
    // 3. Parse request body (optional filters)
    // ============================================================================
    let requestBody: RequestBody = {}
    try {
      const bodyText = await req.text()
      if (bodyText) {
        requestBody = JSON.parse(bodyText)
      }
    } catch (parseError) {
      console.log('No request body or invalid JSON, using defaults')
    }

    const filters = requestBody.filters || {}
    const limit = requestBody.limit || 10

    console.log('Filters:', filters)
    console.log('Limit:', limit)

    // ============================================================================
    // 4. Fetch user preferences
    // ============================================================================
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('preferred_categories, preferred_regions, risk_tolerance')
      .eq('user_id', user.id)
      .maybeSingle()

    if (preferencesError) {
      console.error('Error fetching preferences:', preferencesError)
    }

    console.log('User preferences:', preferences)

    // ============================================================================
    // 5. Fetch user's past investments to infer interests
    // ============================================================================
    const { data: investments, error: investmentsError } = await supabase
      .from('investments')
      .select('campaign_id, campaigns(category_id, location)')
      .eq('investor_id', user.id)
      .eq('status', 'confirmed')
      .limit(20)

    if (investmentsError) {
      console.error('Error fetching investments:', investmentsError)
    }

    // Extract category IDs and regions from past investments
    const investedCategoryIds = investments?.map(inv => {
      const campaigns = inv.campaigns as { category_id: string; location: string } | undefined
      return campaigns?.category_id
    }).filter(Boolean) || []
    const investedRegions = investments?.map(inv => {
      const campaigns = inv.campaigns as { category_id: string; location: string } | undefined
      return campaigns?.location
    }).filter(Boolean) || []

    // Combine with user preferences
    const preferredCategoryIds = [
      ...(preferences?.preferred_categories || []),
      ...investedCategoryIds
    ]
    const preferredRegions = [
      ...(preferences?.preferred_regions || []),
      ...investedRegions
    ]

    console.log(`User interests - Categories: ${preferredCategoryIds.length}, Regions: ${preferredRegions.length}`)

    // ============================================================================
    // 5.5. Analyze user's interaction history (recommendation_events)
    // ============================================================================
    const { data: eventData, error: eventsError } = await supabase
      .from('recommendation_events')
      .select('campaign_id, event_type, campaigns(category_id, location, risk_level)')
      .eq('user_id', user.id)
      .in('event_type', ['view', 'click', 'invest'])
      .limit(100)

    if (eventsError) {
      console.error('Error fetching recommendation events:', eventsError)
    }

    // Aggregate interaction patterns
    const categoryFrequency: Record<string, number> = {}
    const regionFrequency: Record<string, number> = {}
    const riskFrequency: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 }
    
    // Track specific interaction types for behavioral boosts
    const investedCategories = new Set<string>()
    const clickedRegions = new Set<string>()
    const investedRiskLevels = new Set<RiskLevel>()

    eventData?.forEach(event => {
      const campaign = event.campaigns as { category_id: string; location: string | null; risk_level: RiskLevel | null } | undefined
      if (!campaign) return
      
      // Weight events differently: invest > click > view
      const weight = event.event_type === 'invest' ? 3 : event.event_type === 'click' ? 2 : 1
      
      // Count categories
      if (campaign.category_id) {
        categoryFrequency[campaign.category_id] = (categoryFrequency[campaign.category_id] || 0) + weight
        if (event.event_type === 'invest') {
          investedCategories.add(campaign.category_id)
        }
      }
      
      // Count regions
      if (campaign.location) {
        regionFrequency[campaign.location] = (regionFrequency[campaign.location] || 0) + weight
        if (event.event_type === 'click' || event.event_type === 'invest') {
          clickedRegions.add(campaign.location)
        }
      }
      
      // Count risk levels
      if (campaign.risk_level) {
        riskFrequency[campaign.risk_level] = (riskFrequency[campaign.risk_level] || 0) + weight
        if (event.event_type === 'invest') {
          investedRiskLevels.add(campaign.risk_level)
        }
      }
    })

    // Extract top patterns from interaction history
    const topInteractedCategories = Object.entries(categoryFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id)

    const topInteractedRegions = Object.entries(regionFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([region]) => region)

    const dominantRiskLevel = (Object.entries(riskFrequency) as [RiskLevel, number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null

    console.log(`Interaction patterns - Top categories: ${topInteractedCategories.length}, Top regions: ${topInteractedRegions.length}, Dominant risk: ${dominantRiskLevel}`)

    // Merge interaction-based insights with user preferences (interaction data takes priority)
    const mergedCategoryIds = [...new Set([...topInteractedCategories, ...preferredCategoryIds])]
    const mergedRegions = [...new Set([...topInteractedRegions, ...preferredRegions])]

    console.log(`Merged interests - Categories: ${mergedCategoryIds.length}, Regions: ${mergedRegions.length}`)

    // ============================================================================
    // 6. Determine user's risk tolerance
    // ============================================================================
    // Use dominant risk level from interactions if available, otherwise fall back to preferences
    const userRiskTolerance: RiskLevel = dominantRiskLevel || preferences?.risk_tolerance || 'MEDIUM'
    console.log(`User risk tolerance: ${userRiskTolerance}${dominantRiskLevel ? ' (from interactions)' : ''}`)

    // ============================================================================
    // 7. Fetch active campaigns with filters
    // ============================================================================
    let campaignsQuery = supabase
      .from('campaigns')
      .select('id, slug, title, category_id, location, risk_level, final_risk_score, status, funding_goal, current_funding, investor_count, categories(name)')
      .eq('status', 'active')

    // Apply category filter if provided
    if (filters.category_ids && filters.category_ids.length > 0) {
      campaignsQuery = campaignsQuery.in('category_id', filters.category_ids)
    }

    // Apply region filter if provided
    if (filters.region) {
      campaignsQuery = campaignsQuery.eq('location', filters.region)
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch campaigns',
          details: campaignsError.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Fetched ${campaigns?.length || 0} active campaigns`)

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          count: 0,
          data: [],
          message: 'No active campaigns found matching your filters'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // ============================================================================
    // 8. Filter by risk level and compute scores
    // ============================================================================
    const riskFilteredCampaigns = campaigns.filter(campaign => 
      passesRiskFilter(
        campaign.risk_level,
        userRiskTolerance,
        filters.max_risk_level
      )
    )
    const scoredCampaigns = riskFilteredCampaigns
      .map(campaign => {
        // Compute weighted recommendation score using new scoring functions
        const fundingRatio = campaign.funding_goal > 0 
          ? campaign.current_funding / campaign.funding_goal 
          : 0
        
        const riskScore = scoreRisk(campaign.risk_level, userRiskTolerance)
        const categoryScore = scoreCategory(campaign.category_id, mergedCategoryIds)
        const regionScore = scoreRegion(campaign.location, mergedRegions)
        const popularityScore = scorePopularity(campaign.investor_count || 0, fundingRatio)
        
        // Apply behavioral boosts based on user's interaction history
        let boostedRiskScore = riskScore
        let boostedCategoryScore = categoryScore
        let boostedRegionScore = regionScore
        
        // Boost for risk level matching past investments (+0.1)
        if (campaign.risk_level && investedRiskLevels.has(campaign.risk_level)) {
          boostedRiskScore = Math.min(boostedRiskScore + 0.1, 1.0)
        }
        
        // Boost for category user invested in (+0.1)
        if (investedCategories.has(campaign.category_id)) {
          boostedCategoryScore = Math.min(boostedCategoryScore + 0.1, 1.0)
        }
        
        // Boost for region user clicked/invested in often (+0.05)
        if (campaign.location && clickedRegions.has(campaign.location)) {
          boostedRegionScore = Math.min(boostedRegionScore + 0.05, 1.0)
        }
        
        // Compute weighted total score (0-100 scale) with behavioral boosts
        const weightedScore = (
          (boostedRiskScore * RECOMMENDATION_WEIGHTS.risk) +
          (boostedCategoryScore * RECOMMENDATION_WEIGHTS.category) +
          (boostedRegionScore * RECOMMENDATION_WEIGHTS.region) +
          (popularityScore * RECOMMENDATION_WEIGHTS.popularity)
        ) * 100
        
        const { reasons, reason_tags } = buildRecommendationExplanation({
          categoryScore,
          regionScore,
          riskScore,
          popularityScore,
          fundingRatio,
          campaignCategoryName: Array.isArray(campaign.categories)
            ? campaign.categories[0]?.name
            : campaign.categories?.name,
          campaignLocation: campaign.location,
          campaignRiskLevel: campaign.risk_level,
          investorCount: campaign.investor_count || 0,
        })

        return {
          campaign: {
            id: campaign.id,
            slug: campaign.slug,
            title: campaign.title,
            category: (Array.isArray(campaign.categories) ? campaign.categories[0]?.name : campaign.categories?.name) || 'Uncategorized',
            region: campaign.location || 'Not specified',
            risk_level: campaign.risk_level,
            final_risk_score: campaign.final_risk_score,
            funding_goal: campaign.funding_goal,
            current_funding: campaign.current_funding,
            investor_count: campaign.investor_count,
            status: campaign.status
          },
          score: Math.round(weightedScore * 10) / 10, // Round to 1 decimal
          reasons,
          reason_tags
        }
      })

    console.log(`Scored ${scoredCampaigns.length} campaigns after risk filtering`)

    // ============================================================================
    // 9. Sort by recommendation score and limit results
    // ============================================================================
    const topRecommendations = scoredCampaigns
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    console.log(`Returning top ${topRecommendations.length} recommendations`)

    // ============================================================================
    // 10. Log recommendation events for analytics
    // ============================================================================
    if (topRecommendations.length > 0) {
      const events = topRecommendations.map(rec => ({
        user_id: user.id,
        campaign_id: rec.campaign.id,
        event_type: 'impression',
        source: 'campaign_card',
        metadata: {
          score: rec.score,
          position: topRecommendations.indexOf(rec) + 1
        }
      }))

      const { error: logError } = await supabase
        .from('recommendation_events')
        .insert(events)

      if (logError) {
        console.error('Error logging recommendation events:', logError)
        // Don't fail the request if logging fails
      } else {
        console.log(`Logged ${events.length} recommendation impressions`)
      }
    }

    // ============================================================================
    // 11. Return recommendations
    // ============================================================================
    return new Response(
      JSON.stringify({
        success: true,
        count: topRecommendations.length,
        data: topRecommendations
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    const err = error as Error
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: err.message,
        stack: err.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
