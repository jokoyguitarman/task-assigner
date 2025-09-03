-- Debug script to check what happened with user creation

-- 1. Check if the user exists in auth.users
SELECT 
    'AUTH TABLE' as table_name,
    id, 
    email, 
    created_at,
    email_confirmed_at,
    raw_user_meta_data
FROM auth.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d'

UNION ALL

-- 2. Check if the user exists in public.users
SELECT 
    'USERS TABLE' as table_name,
    id::text, 
    email, 
    created_at,
    NULL as email_confirmed_at,
    name::jsonb as raw_user_meta_data
FROM public.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d';

-- 3. Check all recent users in auth table
SELECT 
    'Recent auth users' as info,
    id::text,
    email,
    created_at,
    email_confirmed_at is not null as email_confirmed
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 4. Check all recent users in public.users table  
SELECT 
    'Recent public users' as info,
    id::text,
    email,
    name,
    role,
    created_at
FROM public.users 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 5. Check if triggers exist
SELECT 
    'Current triggers' as info,
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE '%auth_user%';
