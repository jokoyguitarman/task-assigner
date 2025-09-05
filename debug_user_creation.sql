-- Debug user creation issue
-- Check if user already exists and handle duplicates

-- Check if there are any users with the email from the invitation
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE email IN (
    'jokoyguitarman@yahoo.com',
    'therestaurateursph@gmail.com'
);

-- Check if there are any auth users with these emails
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email IN (
    'jokoyguitarman@yahoo.com',
    'therestaurateursph@gmail.com'
);

-- Check the invitations to see which ones are being used
SELECT 
    id,
    email,
    token,
    role,
    used_at,
    created_at
FROM invitations 
WHERE email IN (
    'jokoyguitarman@yahoo.com',
    'therestaurateursph@gmail.com'
);

-- If there are duplicate users, we might need to clean them up
-- This will show any potential conflicts
SELECT 
    'users' as table_name,
    COUNT(*) as count
FROM users 
WHERE email IN (
    'jokoyguitarman@yahoo.com',
    'therestaurateursph@gmail.com'
)
UNION ALL
SELECT 
    'auth.users' as table_name,
    COUNT(*) as count
FROM auth.users 
WHERE email IN (
    'jokoyguitarman@yahoo.com',
    'therestaurateursph@gmail.com'
);