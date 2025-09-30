-- Check what enum values exist for verified_status and user_role
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('verified_status', 'user_role')
ORDER BY t.typname, e.enumsortorder;