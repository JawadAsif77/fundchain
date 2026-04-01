import { supabase } from '../lib/supabase';

// Investment service functions for calling Edge Functions
const functionsBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/`;

const getAuthHeaders = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('No active session');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
};

/**
 * Invest FC tokens in a campaign
 */
export async function investInCampaign(userId, campaignId, amountFc) {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${functionsBase}invest-in-campaign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ campaignId, amount: amountFc })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Investment failed');
    }

    return data;
  } catch (error) {
    console.error('investInCampaign error:', error);
    throw error;
  }
}

/**
 * Get all investments made by a user
 */
export async function getUserInvestments(userId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${functionsBase}get-user-investments`, {
    method: 'POST',
    headers
  });
  return await response.json();
}

/**
 * Get all investments for a specific campaign
 * Note: This function is a placeholder - the Edge Function needs to be created
 */
export async function getCampaignInvestments(campaignId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${functionsBase}get-campaign-investments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ campaignId })
  });
  return await response.json();
}
