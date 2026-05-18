import { supabase } from '../lib/supabase.js';
import { safeLogger } from '../utils/safeLogger';

/**
 * Get personalized campaign recommendations for the authenticated user
 * 
 * @param {Object} filters - Optional filters object
 * @param {string[]} filters.category_ids - Array of category IDs to filter by
 * @param {string} filters.region - Region to filter by
 * @param {string} filters.funding_stage - Funding stage: "early" | "mid" | "late"
 * @param {string} filters.max_risk_level - Maximum risk level: "LOW" | "MEDIUM" | "HIGH"
 * @param {number} limit - Maximum number of recommendations to return (default: 10)
 * @returns {Promise<Array>} Array of recommended campaigns with scores and reasons
 * @throws {Error} If the request fails or user is not authenticated
 */
export async function getRecommendedProjects(filters = {}, limit = 10) {
  try {
    safeLogger.debug('Recommendations request started');

    // Get existing session - NO need to refresh, Supabase handles token refresh automatically
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw new Error('You must be logged in to get recommendations');
    }
    
    if (!session || !session.access_token) {
      throw new Error('You must be logged in to get recommendations');
    }

    return await fetchRecommendations(session, filters, limit);

  } catch (error) {
    throw error;
  }
}

async function fetchRecommendations(session, filters, limit) {
  // Make a raw fetch call to see the actual error response
  const functionUrl = `${supabase.supabaseUrl}/functions/v1/recommend_projects`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': supabase.supabaseKey
    },
    body: JSON.stringify({ filters, limit })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch recommendations');
  }

  const data = await response.json();

  if (!data || !data.success) {
    throw new Error('Invalid response from recommendations service');
  }
  
  return data.recommendations || [];
}

/**
 * Get recommendation metadata (user profile, filters applied, etc.)
 * 
 * @param {Object} filters - Optional filters object
 * @param {number} limit - Maximum number of recommendations to return
 * @returns {Promise<Object>} Full response including recommendations and metadata
 */
export async function getRecommendationsWithMetadata(filters = {}, limit = 10) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('You must be logged in to get recommendations');
    }

    const { data, error } = await supabase.functions.invoke('recommend_projects', {
      body: {
        filters,
        limit
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch recommendations');
    }

    if (!data || !data.success) {
      throw new Error(data?.error || 'Invalid response from recommendations service');
    }

    return data; // Returns full response with recommendations and metadata

  } catch (error) {
    console.error('Error fetching recommendations with metadata:', error);
    throw error;
  }
}

/**
 * Log a recommendation interaction event (click, view, etc.)
 * 
 * @param {string} campaignId - ID of the campaign that was interacted with
 * @param {string} eventType - Type of event: "click" | "view" | "invest"
 * @param {Object} metadata - Additional metadata about the interaction
 */
export async function logRecommendationEvent(campaignId, eventType = 'click', metadata = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log recommendation event: user not authenticated');
      return;
    }

    const { error } = await supabase
      .from('recommendation_events')
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        event_type: eventType,
        source: 'module11',
        metadata
      });

    if (error) {
      console.error('Error logging recommendation event:', error);
      // Don't throw - logging failure shouldn't break the app
    } else {
      console.log(`✅ Logged ${eventType} event for campaign ${campaignId}`);
    }

  } catch (error) {
    console.error('Error in logRecommendationEvent:', error);
    // Silently fail - logging shouldn't break the app
  }
}
