-- =============================================================================
-- GET CAMPAIGN STATS RPC FUNCTION
-- =============================================================================
-- This function calculates real-time campaign statistics from the investments table
-- It's used by the API to get accurate funding data without relying on triggers
-- =============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_campaign_stats;

-- Create the get_campaign_stats function
CREATE OR REPLACE FUNCTION get_campaign_stats(campaign_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'current_funding', COALESCE(SUM(i.amount), 0),
        'investor_count', COUNT(DISTINCT i.investor_id)
    ) INTO result
    FROM investments i
    WHERE i.campaign_id = get_campaign_stats.campaign_id 
      AND i.status = 'confirmed';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_campaign_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_stats TO anon;

-- Add comment
COMMENT ON FUNCTION get_campaign_stats IS 'Returns real-time funding statistics for a specific campaign';