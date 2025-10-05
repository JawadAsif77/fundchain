-- =============================================================================
-- CAMPAIGN STATS RPC FUNCTION (FIXED VERSION)
-- =============================================================================
-- This function calculates real-time campaign funding statistics
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================================================

-- Drop existing function first
DROP FUNCTION IF EXISTS get_campaign_stats(uuid);

-- Create the RPC function with correct parameter name
CREATE OR REPLACE FUNCTION get_campaign_stats(campaign_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'current_funding', COALESCE(SUM(i.amount), 0),
        'investor_count', COUNT(DISTINCT i.investor_id),
        'funding_goal', c.funding_goal,
        'funding_percentage', 
            CASE 
                WHEN c.funding_goal > 0 THEN 
                    ROUND((COALESCE(SUM(i.amount), 0) / c.funding_goal) * 100, 2)
                ELSE 0 
            END
    )
    INTO result
    FROM campaigns c
    LEFT JOIN investments i ON c.id = i.campaign_id AND i.status = 'confirmed'
    WHERE c.id = campaign_uuid
    GROUP BY c.id, c.funding_goal;
    
    RETURN COALESCE(result, '{"current_funding": 0, "investor_count": 0, "funding_goal": 0, "funding_percentage": 0}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_campaign_stats(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_campaign_stats(UUID) IS 'Returns real-time funding statistics for a campaign including current funding, investor count, and funding percentage';