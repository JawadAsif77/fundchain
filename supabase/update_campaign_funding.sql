-- =============================================================================
-- UPDATE CAMPAIGN FUNDING FROM INVESTMENTS
-- =============================================================================
-- This script updates the current_funding and investor_count fields 
-- in campaigns table based on confirmed investments
-- =============================================================================

-- First, let's see what we have
SELECT 
    c.id,
    c.title,
    c.current_funding as current_stored_funding,
    c.investor_count as current_stored_count,
    COALESCE(SUM(i.amount), 0) as calculated_funding,
    COUNT(DISTINCT i.investor_id) as calculated_count
FROM campaigns c
LEFT JOIN investments i ON c.id = i.campaign_id AND i.status = 'confirmed'
GROUP BY c.id, c.title, c.current_funding, c.investor_count
ORDER BY c.created_at DESC;

-- Update all campaigns with correct funding data
UPDATE campaigns 
SET 
    current_funding = COALESCE(investment_stats.total_funding, 0),
    investor_count = COALESCE(investment_stats.investor_count, 0),
    updated_at = NOW()
FROM (
    SELECT 
        campaign_id,
        SUM(amount) as total_funding,
        COUNT(DISTINCT investor_id) as investor_count
    FROM investments 
    WHERE status = 'confirmed'
    GROUP BY campaign_id
) as investment_stats
WHERE campaigns.id = investment_stats.campaign_id;

-- Reset campaigns that have no confirmed investments
UPDATE campaigns 
SET 
    current_funding = 0,
    investor_count = 0,
    updated_at = NOW()
WHERE id NOT IN (
    SELECT DISTINCT campaign_id 
    FROM investments 
    WHERE status = 'confirmed' AND campaign_id IS NOT NULL
);

-- Verify the update
SELECT 
    c.id,
    c.title,
    c.current_funding,
    c.investor_count,
    c.funding_goal,
    CASE 
        WHEN c.funding_goal > 0 THEN ROUND((c.current_funding / c.funding_goal * 100), 2)
        ELSE 0 
    END as funding_percentage
FROM campaigns c
ORDER BY c.current_funding DESC;