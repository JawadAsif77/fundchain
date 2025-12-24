import { supabase } from '../lib/supabase'

export async function analyzeCampaignRisk(campaignId) {
  const { data, error } = await supabase.functions.invoke(
    'analyze_project',
    {
      body: { campaign_id: campaignId }
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  return data
}
