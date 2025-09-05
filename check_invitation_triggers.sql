-- Check for triggers on the invitations table that might be creating users
-- This could be causing users to be created automatically when invitations are sent

-- Check for triggers on invitations table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'invitations'
ORDER BY trigger_name;

-- Check for functions that might be called by these triggers
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name LIKE '%invitation%' 
   OR routine_name LIKE '%user%'
   OR routine_name LIKE '%signup%'
ORDER BY routine_name;

-- Check the actual trigger function definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'invitations';
