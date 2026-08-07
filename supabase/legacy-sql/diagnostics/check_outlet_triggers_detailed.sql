-- Check what triggers exist on the outlets table
-- This will show us exactly what we're disabling

-- Check for triggers on outlets table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'outlets'
ORDER BY trigger_name;

-- Check for functions that might be called by these triggers
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name LIKE '%outlet%' 
   OR routine_name LIKE '%auth%'
   OR routine_name LIKE '%user%'
ORDER BY routine_name;

-- Check the actual trigger function definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'outlets';
