-- Debug script to check user role in database vs what app sees

-- Check the actual user data in the database
SELECT 
    'Database user data' as source,
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM public.users 
WHERE email = 'cucinailocana@yahoo.com';

-- Check if there are multiple users with same email
SELECT 
    'All users with this email' as source,
    id,
    email,
    name,
    role,
    created_at
FROM public.users 
WHERE email = 'cucinailocana@yahoo.com'
ORDER BY created_at;

-- Check auth.users table to see if there's a mismatch
SELECT 
    'Auth table data' as source,
    id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'cucinailocana@yahoo.com';

-- Check current authenticated user context
SELECT 
    'Current auth context' as source,
    auth.uid() as current_user_id,
    current_setting('role') as current_role;

-- See what the user lookup query returns
SELECT 
    'User lookup result' as source,
    u.id,
    u.email,
    u.name,
    u.role
FROM public.users u
WHERE u.id = auth.uid();

-- Count total users in database
SELECT 
    'Total users count' as info,
    COUNT(*) as count,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'staff' THEN 1 END) as staff_count
FROM public.users;
