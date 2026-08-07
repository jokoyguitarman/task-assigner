-- Debug the login issue after successful signup and email verification
-- Check if the user exists in both auth.users and public.users

-- Check auth.users (Supabase Auth table)
SELECT 'Users in auth.users:' as info;
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'jokoyguitarman@yahoo.com'
ORDER BY created_at DESC;

-- Check public.users (our custom table)
SELECT 'Users in public.users:' as info;
SELECT id, email, name, role, created_at 
FROM public.users 
WHERE email = 'jokoyguitarman@yahoo.com'
ORDER BY created_at DESC;

-- Check if there's a mismatch between the tables
SELECT 'Potential mismatch check:' as info;
SELECT 
    a.id as auth_id,
    a.email as auth_email,
    a.email_confirmed_at,
    p.id as public_id,
    p.email as public_email,
    p.role
FROM auth.users a
FULL OUTER JOIN public.users p ON a.id = p.id
WHERE a.email = 'jokoyguitarman@yahoo.com' OR p.email = 'jokoyguitarman@yahoo.com';










