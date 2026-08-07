-- SQL script to sync users from auth.users to public.users table
-- This will create user profiles for all authenticated users who don't have them yet

-- Insert users from auth.users into public.users where they don't already exist
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'full_name', 
        SPLIT_PART(au.email, '@', 1)
    ) as name,
    -- Default role logic: you can modify this based on your needs
    CASE 
        WHEN au.email LIKE '%admin%' THEN 'admin'
        WHEN au.email IN ('your-admin-email@domain.com') THEN 'admin'  -- Replace with your admin email
        ELSE 'staff'
    END as role,
    au.created_at,
    au.updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL  -- Only insert users that don't already exist
AND au.email_confirmed_at IS NOT NULL;  -- Only confirmed users

-- Optional: Update existing users with missing information
UPDATE public.users 
SET 
    email = auth_users.email,
    name = COALESCE(
        public.users.name,
        auth_users.raw_user_meta_data->>'name',
        auth_users.raw_user_meta_data->>'full_name',
        SPLIT_PART(auth_users.email, '@', 1)
    ),
    updated_at = NOW()
FROM auth.users auth_users
WHERE public.users.id = auth_users.id
AND (
    public.users.email IS NULL 
    OR public.users.name IS NULL 
    OR public.users.name = ''
);

-- Show the results
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.created_at,
    'Synced from auth.users' as source
FROM public.users u
ORDER BY u.created_at DESC;
