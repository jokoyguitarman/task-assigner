-- Debug why login is failing when user exists in both tables
-- Check the exact data and see if there are any issues

-- Check the exact user data in auth.users
SELECT 'Auth user details:' as info;
SELECT 
    id,
    email,
    email_confirmed_at,
    encrypted_password,
    created_at,
    updated_at
FROM auth.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- Check the exact user data in public.users
SELECT 'Public user details:' as info;
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM public.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- Check if the IDs match between tables
SELECT 'ID comparison:' as info;
SELECT 
    a.id as auth_id,
    p.id as public_id,
    a.id = p.id as ids_match
FROM auth.users a
JOIN public.users p ON a.email = p.email
WHERE a.email = 'jokoyguitarman@yahoo.com';

-- Check if email is confirmed
SELECT 'Email confirmation status:' as info;
SELECT 
    email,
    email_confirmed_at IS NOT NULL as is_confirmed,
    email_confirmed_at
FROM auth.users 
WHERE email = 'jokoyguitarman@yahoo.com';









