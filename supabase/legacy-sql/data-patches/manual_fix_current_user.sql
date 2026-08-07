-- Manual fix to create the missing user profile for the current user
-- This will immediately solve your login issue

-- Insert the missing user profile using the ID from your network request
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'full_name',
        SPLIT_PART(au.email, '@', 1)
    ) as name,
    'admin' as role,  -- Making this user an admin
    au.created_at,
    NOW()
FROM auth.users au
WHERE au.id = '69b388f9-2f6c-4312-8518-5a76cce5209d'  -- The ID from your network request
AND NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
);

-- Verify the user was created
SELECT 
    'User profile created:' as status,
    id,
    email,
    name,
    role
FROM public.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d';
