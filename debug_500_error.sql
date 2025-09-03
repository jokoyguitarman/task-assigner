-- Debug script to understand the 500 error
-- This will help us see what's happening with the user query

-- 1. Check if the user exists and can be queried
SELECT 
    'Direct user query test' as test,
    id, 
    email, 
    name, 
    role,
    created_at
FROM public.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d';

-- 2. Test the exact query that the app is making
SELECT 
    'App-style query test' as test,
    *
FROM public.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d';

-- 3. Check what the current authenticated user context is
SELECT 
    'Auth context' as test,
    auth.uid() as current_user_id,
    current_setting('role') as current_role;

-- 4. Check if there are any policy violations
SELECT 
    'Policy check' as test,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- 5. Test if we can query users table at all
SELECT 
    'General users query' as test,
    count(*) as total_users
FROM public.users;

-- 6. Check for any constraint violations or data issues
SELECT 
    'Data validation' as test,
    id,
    email IS NOT NULL as has_email,
    name IS NOT NULL as has_name,
    role IS NOT NULL as has_role,
    created_at IS NOT NULL as has_created_at
FROM public.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d';
