-- Add 'pending_review' and 'rejected' statuses to campaign_status enum
-- Run this migration to fix campaign rejection and approval flow

-- Add new values to the enum
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'rejected';

-- Update any campaigns currently using invalid statuses
-- (This is safe to run even if no campaigns need updating)
UPDATE campaigns 
SET status = 'draft' 
WHERE status NOT IN ('draft', 'pending_review', 'active', 'completed', 'failed', 'cancelled', 'rejected');

-- Verification: Check all campaign statuses
SELECT status, COUNT(*) as count
FROM campaigns
GROUP BY status
ORDER BY count DESC;
