-- Quick fix to add your current user profile
-- Replace 'your-email@domain.com' with your actual email

INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'name', SPLIT_PART(email, '@', 1)) as name,
    'admin' as role,
    created_at,
    updated_at
FROM auth.users 
WHERE email = 'your-email@domain.com'  -- Replace with your actual email
AND id NOT IN (SELECT id FROM public.users);

-- Verify it worked
SELECT * FROM public.users WHERE email = 'your-email@domain.com';
