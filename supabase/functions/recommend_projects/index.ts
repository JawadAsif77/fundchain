// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// ============================================================================
// Recommendation Weights
// ============================================================================
const RECOMMENDATION_WEIGHTS = {
  risk: 0.4,
  category: 0.25,
  region: 0.15,
  popularity: 0.2
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================================
// Types
// ============================================================================
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
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

// ============================================================================
// Helper: Get risk level numeric value for comparisons
// ============================================================================
function getRiskValue(level: RiskLevel | null): number {
  if (!level) return 1 // Default to MEDIUM
  if (level === 'LOW') return 0
  if (level === 'MEDIUM') return 1
  return 2 // HIGH
}

// ============================================================================
// Helper: Check if campaign passes risk filter
// ============================================================================
function passesRiskFilter(
  campaignRisk: RiskLevel | null,
  userTolerance: RiskLevel,
  maxRiskFilter?: RiskLevel
): boolean {
  // Apply user-specified max risk filter if provided
  const effectiveMaxRisk = maxRiskFilter || userTolerance
  
  // If no risk level, allow it (will get penalty in scoring)
  if (!campaignRisk) return true
  
  const campaignValue = getRiskValue(campaignRisk)
  const maxValue = getRiskValue(effectiveMaxRisk)
  
  return campaignValue <= maxValue
}

// ============================================================================
// Helper: Compute recommendation score and reasons
// ============================================================================
function computeRecommendation(
  campaign: Campaign,
  userPreferences: UserPreferences | null,
  userCategoryIds: string[],
  userRegions: string[],
  filters?: Filters
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  
  // Base score
  score += 10
  
  // Category match (30 points)
  if (userCategoryIds.includes(campaign.category_id)) {
    score += 30
    reasons.push(`Matches your interest in ${campaign.categories?.name || 'this category'}`)
  }
  
  // Region match (20 points)
  if (campaign.location && userRegions.includes(campaign.location)) {
    score += 20
    reasons.push(`Located in your preferred region: ${campaign.location}`)
  }
  
  // Funding stage match (15 points)
  if (filters?.funding_stage) {
    const campaignStage = getFundingStage(campaign.current_funding, campaign.funding_goal)
    if (campaignStage === filters.funding_stage) {
      score += 15
      reasons.push(`In ${campaignStage} funding stage as you prefer`)
    }
  }
  
  // Risk alignment (25 points max, penalty for higher risk)
  const userRiskTolerance = userPreferences?.risk_tolerance || 'MEDIUM'
  const campaignRiskValue = getRiskValue(campaign.risk_level)
  const userRiskValue = getRiskValue(userRiskTolerance)
  
  if (campaign.risk_level) {
    if (campaignRiskValue === userRiskValue) {
      score += 25
      reasons.push(`Risk level (${campaign.risk_level}) matches your tolerance`)
    } else if (campaignRiskValue < userRiskValue) {
      score += 15
      reasons.push(`Lower risk (${campaign.risk_level}) than your tolerance`)
    } else {
      // Higher risk than tolerance - penalty
      const penalty = (campaignRiskValue - userRiskValue) * 10
      score -= penalty
      reasons.push(`Higher risk level: ${campaign.risk_level}`)
    }
  } else {
    reasons.push('Risk analysis pending')
  }
  
  // Funding progress bonus (0-10 points) - campaigns with some traction
  const progress = campaign.funding_goal > 0 
    ? Math.min(campaign.current_funding / campaign.funding_goal, 1) 
    : 0
  
  if (progress > 0.1 && progress < 0.8) {
    const progressBonus = Math.floor(progress * 10)
    score += progressBonus
    reasons.push(`${Math.floor(progress * 100)}% funded - gaining traction`)
  }
  
  return { score: Math.max(0, score), reasons }
}

// ============================================================================
// Scoring Helper Functions
// ============================================================================

/**
 * Score based on risk alignment (0-1)
 * Returns 1 if project risk <= max risk, decreases for higher risk
 */
function scoreRisk(projectRisk: RiskLevel | null, maxRisk: RiskLevel): number {
  if (!projectRisk) return 0.5 // Neutral score for unanalyzed projects
  
  const projectValue = getRiskValue(projectRisk)
  const maxValue = getRiskValue(maxRisk)
  
  if (projectValue <= maxValue) return 1.0
  if (projectValue === maxValue + 1) return 0.3
  return 0.0
}

/**
 * Score based on category match (0-1)
 * Returns 1 if category matches user preferences, 0 otherwise
 */
function scoreCategory(projectCategory: string, preferredCategories: string[]): number {
  if (preferredCategories.length === 0) return 0.5 // Neutral if no preferences
  return preferredCategories.includes(projectCategory) ? 1.0 : 0.0
}

/**
 * Score based on region match (0-1)
 * Returns 1 if region matches, 0.5 if no region specified, 0 otherwise
 */
function scoreRegion(projectRegion: string | null, userRegion: string[]): number {
  if (!projectRegion) return 0.5 // Neutral if no region specified
  if (userRegion.length === 0) return 0.5 // Neutral if user has no region preference
  return userRegion.includes(projectRegion) ? 1.0 : 0.0
}

/**
 * Score based on popularity metrics (0-1)
 * Combines investor count and funding ratio
 */
function scorePopularity(investorCount: number, fundingRatio: number): number {
  // Normalize investor count (assume 50+ investors is max popularity)
  const investorScore = Math.min(investorCount / 50, 1.0)
  
  // Funding ratio score (prefer 20-80% funded)
  let fundingScore = 0
  if (fundingRatio >= 0.2 && fundingRatio <= 0.8) {
    fundingScore = 1.0
  } else if (fundingRatio > 0.8) {
    fundingScore = 0.5 // Nearly funded
  } else if (fundingRatio > 0.1) {
    fundingScore = 0.7 // Some traction
  } else {
    fundingScore = 0.3 // Very early
  }
  
  // Combine both metrics (weighted average)
  return (investorScore * 0.4) + (fundingScore * 0.6)
}

// ============================================================================
// Reason Tags
// ============================================================================
const REASON_TAGS = {
  lowRisk: 'Low risk profile',
  mediumRisk: 'Medium risk profile',
  regionMatch: 'Located in your preferred region',
  categoryMatch: 'Matches your investment interests',
  popularProject: 'Popular among investors'
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
    const scoredCampaigns = campaigns
      .filter(campaign => 
        passesRiskFilter(
          campaign.risk_level,
          userRiskTolerance,
          filters.max_risk_level
        )
      )
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
        
        // Generate human-readable reasons
        const reasons: string[] = []
        if (categoryScore === 1.0) {
          reasons.push(`Matches your interest in ${campaign.categories?.name || 'this category'}`)
        }
        if (regionScore === 1.0) {
          reasons.push(`Located in your preferred region: ${campaign.location}`)
        }
        if (riskScore === 1.0) {
          reasons.push(`Risk level (${campaign.risk_level}) matches your tolerance`)
        }
        if (fundingRatio > 0.2 && fundingRatio < 0.8) {
          reasons.push(`${Math.floor(fundingRatio * 100)}% funded - gaining traction`)
        }
        if ((campaign.investor_count || 0) > 10) {
          reasons.push(`Popular with ${campaign.investor_count} investors`)
        }

        // Generate reason tags (limit to 3)
        const reason_tags: string[] = []
        
        // Add risk tag
        if (campaign.risk_level === 'LOW') {
          reason_tags.push(REASON_TAGS.lowRisk)
        } else if (campaign.risk_level === 'MEDIUM') {
          reason_tags.push(REASON_TAGS.mediumRisk)
        }
        
        // Add category match tag
        if (categoryScore === 1.0 && reason_tags.length < 3) {
          reason_tags.push(REASON_TAGS.categoryMatch)
        }
        
        // Add region match tag
        if (regionScore === 1.0 && reason_tags.length < 3) {
          reason_tags.push(REASON_TAGS.regionMatch)
        }
        
        // Add popularity tag
        if (popularityScore > 0.6 && reason_tags.length < 3) {
          reason_tags.push(REASON_TAGS.popularProject)
        }

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
        source: 'module11',
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
