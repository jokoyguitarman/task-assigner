-- Check for triggers on the outlets table that might be causing the auth.users insert error

-- Check for triggers on outlets table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'outlets';

-- Check for functions that might be called by triggers
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%outlet%' 
   OR routine_name LIKE '%auth%'
   OR routine_name LIKE '%user%';

-- Check if there's a trigger that creates auth users
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement,
    p.proname as function_name
FROM information_schema.triggers t
LEFT JOIN pg_proc p ON t.action_statement LIKE '%' || p.proname || '%'
WHERE t.event_object_table = 'outlets';
