-- Check what triggers exist on outlets table and their events
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'outlets'
ORDER BY trigger_name;
