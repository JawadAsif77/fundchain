-- =============================================================================
-- CAMPAIGN FUNDING UPDATE TRIGGER (FIXED VERSION)
-- =============================================================================
-- This trigger automatically updates campaign funding when investments change
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_campaign_funding_trigger ON investments;
DROP FUNCTION IF EXISTS update_campaign_funding_stats();

-- Create function to update campaign funding statistics
CREATE OR REPLACE FUNCTION update_campaign_funding_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_campaign_id UUID;
BEGIN
    -- Determine which campaign to update
    IF TG_OP = 'DELETE' THEN
        target_campaign_id := OLD.campaign_id;
    ELSE
        target_campaign_id := NEW.campaign_id;
    END IF;
    
    -- Skip if campaign_id is null
    IF target_campaign_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Update campaign statistics based on confirmed investments
    UPDATE campaigns 
    SET 
        current_funding = COALESCE(investment_stats.total_funding, 0),
        investor_count = COALESCE(investment_stats.investor_count, 0),
        updated_at = NOW()
    FROM (
        SELECT 
            SUM(amount) as total_funding,
            COUNT(DISTINCT investor_id) as investor_count
        FROM investments 
        WHERE campaign_id = target_campaign_id 
          AND status = 'confirmed'
    ) as investment_stats
    WHERE campaigns.id = target_campaign_id;
    
    -- If no confirmed investments exist, set to zero
    UPDATE campaigns 
    SET 
        current_funding = 0,
        investor_count = 0,
        updated_at = NOW()
    WHERE id = target_campaign_id
      AND NOT EXISTS (
          SELECT 1 FROM investments 
          WHERE campaign_id = target_campaign_id 
            AND status = 'confirmed'
      );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires on investment changes
CREATE TRIGGER update_campaign_funding_trigger
    AFTER INSERT OR UPDATE OR DELETE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_funding_stats();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_campaign_funding_stats() TO authenticated;

-- Add comment
COMMENT ON FUNCTION update_campaign_funding_stats() IS 'Updates campaign funding statistics when investments change';