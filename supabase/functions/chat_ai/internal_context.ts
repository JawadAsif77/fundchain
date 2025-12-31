import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

interface ContextParams {
  supabase: SupabaseClient;
  userId?: string;
  campaignId?: string;
  campaignSlug?: string;
  includeRecommendations?: boolean;
  includeRiskAnalysis?: boolean;
  includeFundingStats?: boolean;
}

interface InternalContext {
  campaign?: {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    status: string;
    funding_goal: number;
    current_funding: number;
    investor_count: number;
    creator_name?: string;
    deadline?: string;
  };
  riskAnalysis?: {
    risk_level: string;
    final_risk_score: number;
    risk_factors: any;
    analysis_date?: string;
  };
  recommendationReasons?: {
    score: number;
    reasons: string[];
    reason_tags: string[];
  };
  fundingStats?: {
    total_raised: number;
    funding_progress: number;
    days_remaining?: number;
    recent_investments?: Array<{
      amount: number;
      date: string;
    }>;
  };
  userProfile?: {
    preferred_categories: string[];
    preferred_regions: string[];
    risk_tolerance: string;
    total_invested: number;
  };
}

/**
 * Build internal context by fetching relevant data from Supabase
 */
export async function buildInternalContext(params: ContextParams): Promise<InternalContext> {
  const context: InternalContext = {};

  try {
    // Fetch campaign details
    if (params.campaignId || params.campaignSlug) {
      const campaign = await fetchCampaignDetails(params);
      if (campaign) {
        context.campaign = campaign;
      }
    }

    // Fetch risk analysis
    if (params.includeRiskAnalysis && (params.campaignId || params.campaignSlug)) {
      const riskAnalysis = await fetchRiskAnalysis(params);
      if (riskAnalysis) {
        context.riskAnalysis = riskAnalysis;
      }
    }

    // Fetch recommendation reasons
    if (params.includeRecommendations && params.userId && params.campaignId) {
      const recommendationReasons = await fetchRecommendationReasons(params);
      if (recommendationReasons) {
        context.recommendationReasons = recommendationReasons;
      }
    }

    // Fetch funding stats
    if (params.includeFundingStats && (params.campaignId || params.campaignSlug)) {
      const fundingStats = await fetchFundingStats(params);
      if (fundingStats) {
        context.fundingStats = fundingStats;
      }
    }

    // Fetch user profile if userId provided
    if (params.userId) {
      const userProfile = await fetchUserProfile(params);
      if (userProfile) {
        context.userProfile = userProfile;
      }
    }

    return context;
  } catch (error) {
    console.error('Error building internal context:', error);
    return context;
  }
}

/**
 * Fetch campaign details from database
 */
async function fetchCampaignDetails(params: ContextParams) {
  try {
    let query = params.supabase
      .from('campaigns')
      .select(`
        id,
        slug,
        title,
        description,
        short_description,
        location,
        status,
        funding_goal,
        current_funding,
        investor_count,
        end_date,
        categories(name),
        users(full_name, display_name)
      `);

    if (params.campaignId) {
      query = query.eq('id', params.campaignId);
    } else if (params.campaignSlug) {
      query = query.eq('slug', params.campaignSlug);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      console.error('Error fetching campaign:', error);
      return null;
    }

    const daysRemaining = data.end_date 
      ? Math.ceil((new Date(data.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: data.id,
      title: data.title,
      description: data.description || data.short_description || '',
      category: (data.categories as any)?.name || 'Uncategorized',
      location: data.location || 'Not specified',
      status: data.status,
      funding_goal: data.funding_goal || 0,
      current_funding: data.current_funding || 0,
      investor_count: data.investor_count || 0,
      creator_name: (data.users as any)?.display_name || (data.users as any)?.full_name || 'Unknown',
      deadline: data.end_date,
      days_remaining: daysRemaining
    };
  } catch (error) {
    console.error('Error in fetchCampaignDetails:', error);
    return null;
  }
}

/**
 * Fetch risk analysis data
 */
async function fetchRiskAnalysis(params: ContextParams) {
  try {
    let campaignId = params.campaignId;

    // If only slug provided, fetch campaign ID first
    if (!campaignId && params.campaignSlug) {
      const { data } = await params.supabase
        .from('campaigns')
        .select('id')
        .eq('slug', params.campaignSlug)
        .maybeSingle();
      
      campaignId = data?.id;
    }

    if (!campaignId) return null;

    const { data, error } = await params.supabase
      .from('campaigns')
      .select('risk_level, final_risk_score, risk_factors')
      .eq('id', campaignId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching risk analysis:', error);
      return null;
    }

    return {
      risk_level: data.risk_level || 'Not analyzed',
      final_risk_score: data.final_risk_score || 0,
      risk_factors: data.risk_factors || {},
      analysis_date: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in fetchRiskAnalysis:', error);
    return null;
  }
}

/**
 * Fetch recommendation reasons from recommendation_events
 */
async function fetchRecommendationReasons(params: ContextParams) {
  try {
    if (!params.userId || !params.campaignId) return null;

    // Check if user has viewed/clicked this campaign through recommendations
    const { data: events } = await params.supabase
      .from('recommendation_events')
      .select('metadata')
      .eq('user_id', params.userId)
      .eq('campaign_id', params.campaignId)
      .in('event_type', ['impression', 'click'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (events && events.metadata) {
      return {
        score: events.metadata.score || 0,
        reasons: events.metadata.reasons || [],
        reason_tags: events.metadata.reason_tags || []
      };
    }

    return null;
  } catch (error) {
    console.error('Error in fetchRecommendationReasons:', error);
    return null;
  }
}

/**
 * Fetch funding statistics
 */
async function fetchFundingStats(params: ContextParams) {
  try {
    let campaignId = params.campaignId;

    // If only slug provided, fetch campaign ID first
    if (!campaignId && params.campaignSlug) {
      const { data } = await params.supabase
        .from('campaigns')
        .select('id')
        .eq('slug', params.campaignSlug)
        .maybeSingle();
      
      campaignId = data?.id;
    }

    if (!campaignId) return null;

    // Fetch campaign funding data
    const { data: campaign } = await params.supabase
      .from('campaigns')
      .select('funding_goal, current_funding, end_date')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return null;

    const fundingProgress = campaign.funding_goal > 0
      ? (campaign.current_funding / campaign.funding_goal) * 100
      : 0;

    const daysRemaining = campaign.end_date
      ? Math.ceil((new Date(campaign.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    // Fetch recent investments
    const { data: recentInvestments } = await params.supabase
      .from('investments')
      .select('amount, created_at')
      .eq('campaign_id', campaignId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      total_raised: campaign.current_funding || 0,
      funding_progress: Math.round(fundingProgress * 10) / 10,
      days_remaining: daysRemaining,
      recent_investments: recentInvestments?.map(inv => ({
        amount: inv.amount,
        date: inv.created_at
      })) || []
    };
  } catch (error) {
    console.error('Error in fetchFundingStats:', error);
    return null;
  }
}

/**
 * Fetch user profile and preferences
 */
async function fetchUserProfile(params: ContextParams) {
  try {
    if (!params.userId) return null;

    // Fetch user preferences
    const { data: preferences } = await params.supabase
      .from('user_preferences')
      .select('preferred_categories, preferred_regions, risk_tolerance')
      .eq('user_id', params.userId)
      .maybeSingle();

    // Fetch total invested amount
    const { data: investments } = await params.supabase
      .from('investments')
      .select('amount')
      .eq('investor_id', params.userId)
      .eq('status', 'confirmed');

    const totalInvested = investments?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

    return {
      preferred_categories: preferences?.preferred_categories || [],
      preferred_regions: preferences?.preferred_regions || [],
      risk_tolerance: preferences?.risk_tolerance || 'MEDIUM',
      total_invested: totalInvested
    };
  } catch (error) {
    console.error('Error in fetchUserProfile:', error);
    return null;
  }
}

/**
 * Format context for LLM consumption
 */
export function formatContextForLLM(context: InternalContext): string {
  const parts: string[] = [];

  if (context.campaign) {
    parts.push(`Campaign Information:
- Title: ${context.campaign.title}
- Description: ${context.campaign.description.substring(0, 200)}${context.campaign.description.length > 200 ? '...' : ''}
- Category: ${context.campaign.category}
- Location: ${context.campaign.location}
- Status: ${context.campaign.status}
- Funding: ${context.campaign.current_funding.toLocaleString()} / ${context.campaign.funding_goal.toLocaleString()} FC
- Investors: ${context.campaign.investor_count}
- Creator: ${context.campaign.creator_name}${context.campaign.days_remaining ? `\n- Days Remaining: ${context.campaign.days_remaining}` : ''}`);
  }

  if (context.riskAnalysis) {
    parts.push(`Risk Analysis:
- Risk Level: ${context.riskAnalysis.risk_level}
- Risk Score: ${context.riskAnalysis.final_risk_score}/100
- Factors: ${JSON.stringify(context.riskAnalysis.risk_factors)}`);
  }

  if (context.recommendationReasons) {
    parts.push(`Recommendation Details:
- Match Score: ${context.recommendationReasons.score}
- Reasons: ${context.recommendationReasons.reasons.join(', ')}
- Tags: ${context.recommendationReasons.reason_tags.join(', ')}`);
  }

  if (context.fundingStats) {
    parts.push(`Funding Statistics:
- Total Raised: ${context.fundingStats.total_raised.toLocaleString()} FC
- Progress: ${context.fundingStats.funding_progress}%${context.fundingStats.days_remaining ? `\n- Days Remaining: ${context.fundingStats.days_remaining}` : ''}
- Recent Investments: ${context.fundingStats.recent_investments?.length || 0} recent transactions`);
  }

  if (context.userProfile) {
    parts.push(`User Profile:
- Preferred Categories: ${context.userProfile.preferred_categories.join(', ') || 'None set'}
- Preferred Regions: ${context.userProfile.preferred_regions.join(', ') || 'None set'}
- Risk Tolerance: ${context.userProfile.risk_tolerance}
- Total Invested: ${context.userProfile.total_invested.toLocaleString()} FC`);
  }

  return parts.join('\n\n');
}
