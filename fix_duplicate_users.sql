-- Fix duplicate user constraint violation
-- This happens when there's already a user record in public.users with the same ID

-- First, let's see what users exist in both tables
SELECT 'Users in auth.users:' as info;
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

SELECT 'Users in public.users:' as info;
SELECT id, email, role, created_at FROM public.users ORDER BY created_at DESC LIMIT 5;

-- Check for any duplicate IDs between the tables
SELECT 'Duplicate IDs found:' as info;
SELECT a.id, a.email as auth_email, p.email as public_email, p.role
FROM auth.users a
INNER JOIN public.users p ON a.id = p.id;

-- If there are duplicates, we need to clean them up
-- First, clean up any orphaned staff_profiles or outlets that reference non-existent users
DELETE FROM public.staff_profiles 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.outlets 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Now delete any public.users records that don't have corresponding auth.users records
-- (these are likely leftover from our previous attempts)
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- Show final state
SELECT 'Final user count in public.users:' as info;
SELECT COUNT(*) as count FROM public.users;

SELECT 'Users ready for signup:' as info;
SELECT id, email, role FROM public.users ORDER BY created_at DESC;
