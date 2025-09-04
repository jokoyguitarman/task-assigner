-- Debug login issue after role change
-- Check if the user data is correct

-- 1. Check the user record
SELECT id, email, name, role, created_at, updated_at 
FROM public.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- 2. Check if the user exists in auth.users (Supabase auth table)
SELECT id, email, email_confirmed_at, created_at, updated_at
FROM auth.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- 3. Check the outlet linkage
SELECT id, name, user_id, created_at
FROM public.outlets 
WHERE user_id = '7df0cde8-a5c6-4ce2-8743-c8910066578f';

-- 4. Check if there are any RLS policies blocking access
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('users', 'outlets') 
AND schemaname = 'public';



