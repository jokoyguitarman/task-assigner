-- Custom version with more specific role assignment logic
-- Replace the email addresses with your actual admin emails

INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'full_name', 
        SPLIT_PART(au.email, '@', 1)
    ) as name,
    -- Customize this section with your specific admin emails
    CASE 
        -- Add your admin emails here
        WHEN au.email IN (
            'admin@yourcompany.com',
            'manager@yourcompany.com',
            'youremail@domain.com'  -- Replace with your actual email
        ) THEN 'admin'
        -- Anyone with 'admin' in their email
        WHEN au.email LIKE '%admin%' THEN 'admin'
        -- Anyone with 'manager' in their email  
        WHEN au.email LIKE '%manager%' THEN 'admin'
        -- Everyone else is staff
        ELSE 'staff'
    END as role,
    au.created_at,
    au.updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
AND au.email_confirmed_at IS NOT NULL;

-- Show what was created
SELECT 
    email,
    name, 
    role,
    'Just created' as status
FROM public.users 
WHERE created_at >= NOW() - INTERVAL '1 minute'
ORDER BY created_at DESC;
