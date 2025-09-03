-- Check what users actually exist in the system
-- Maybe the signup didn't work as expected

-- Check all users in auth.users
SELECT 'All users in auth.users:' as info;
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- Check all users in public.users
SELECT 'All users in public.users:' as info;
SELECT id, email, name, role, created_at 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 10;

-- Check recent invitations
SELECT 'Recent invitations:' as info;
SELECT email, role, used_at, created_at 
FROM invitations 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if there are any users with similar emails
SELECT 'Users with similar emails:' as info;
SELECT id, email, created_at 
FROM auth.users 
WHERE email LIKE '%jokoy%' OR email LIKE '%yahoo%'
ORDER BY created_at DESC;
