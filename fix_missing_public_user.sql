-- Fix the missing public.users record for jokoyguitarman@yahoo.com
-- The user exists in auth.users but not in public.users

-- First, let's see what's in auth.users for this user
SELECT 'User data from auth.users:' as info;
SELECT id, email, raw_user_meta_data, created_at 
FROM auth.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- Check if they exist in public.users
SELECT 'User data from public.users:' as info;
SELECT id, email, name, role, created_at 
FROM public.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- Create the missing public.users record
INSERT INTO public.users (id, email, name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'name', 'Unknown User') as name,
    COALESCE(raw_user_meta_data->>'role', 'staff') as role
FROM auth.users 
WHERE email = 'jokoyguitarman@yahoo.com'
AND id NOT IN (SELECT id FROM public.users);

-- Show the result
SELECT 'User created in public.users:' as info;
SELECT id, email, name, role, created_at 
FROM public.users 
WHERE email = 'jokoyguitarman@yahoo.com';









