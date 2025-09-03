-- Clean up all the custom auth users we created
-- Remove fake email users and restore normal Supabase auth flow

-- First, remove any staff profiles that reference fake users
DELETE FROM public.staff_profiles 
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE email LIKE '%@taskassigner.local' OR email LIKE '%outlet@gmail.com'
);

-- Remove any outlet records that reference fake users
DELETE FROM public.outlets 
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE email LIKE '%@taskassigner.local' OR email LIKE '%outlet@gmail.com'
);

-- Now remove the fake users from public.users
DELETE FROM public.users WHERE email LIKE '%@taskassigner.local';
DELETE FROM public.users WHERE email LIKE '%outlet@gmail.com';

-- Remove from auth.users (this should work now)
DELETE FROM auth.users WHERE email LIKE '%@taskassigner.local'; 
DELETE FROM auth.users WHERE email LIKE '%outlet@gmail.com';

-- Clean up any orphaned public users
DELETE FROM public.users pu 
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = pu.id
);

-- Show remaining users (should only be real admin users)
SELECT 'Remaining users after cleanup:' as status;
SELECT 
    au.email as auth_email,
    pu.email as public_email,
    pu.name,
    pu.role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at;
