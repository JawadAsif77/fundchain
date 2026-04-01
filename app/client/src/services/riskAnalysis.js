import { supabase } from '../lib/supabase'

export async function analyzeCampaignRisk(campaignId, analysisMode = 'full') {
  const { data, error } = await supabase.functions.invoke(
    'analyze_project',
    {
      body: {
        campaign_id: campaignId,
        analysis_mode: analysisMode,
      }
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  return data
}
