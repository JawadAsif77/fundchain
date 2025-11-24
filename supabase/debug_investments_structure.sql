-- Test query to check investments table structure
-- Run this in Supabase SQL Editor to see what columns exist

-- Check the investments table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'investments' 
ORDER BY ordinal_position;

-- Check the campaigns table structure  
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
ORDER BY ordinal_position;

-- Check if there are any investments for your user
SELECT id, investor_id, campaign_id, amount, status, investment_date
FROM investments 
WHERE investor_id = 'cef8b66a-92aa-4f30-80cf-24e72f383aee'
LIMIT 5;