-- Clean up users that were created during invitation process
-- This will remove users that exist but haven't completed signup

-- First, let's see what users exist
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY created_at DESC;

-- Check if there are any auth users without corresponding public users
SELECT 
    au.id as auth_id,
    au.email,
    au.created_at as auth_created,
    u.id as public_id
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL
ORDER BY au.created_at DESC;

-- Check if there are any public users without corresponding auth users
SELECT 
    u.id as public_id,
    u.email,
    u.created_at as public_created,
    au.id as auth_id
FROM users u
LEFT JOIN auth.users au ON au.id = u.id
WHERE au.id IS NULL
ORDER BY u.created_at DESC;

-- If you want to clean up users that were created during invitation process,
-- you can uncomment and run these (BE CAREFUL - this will delete data):

-- Delete users that don't have corresponding auth users (likely created by mistake)
-- DELETE FROM users 
-- WHERE id NOT IN (SELECT id FROM auth.users);

-- Delete auth users that don't have corresponding public users (incomplete signup)
-- DELETE FROM auth.users 
-- WHERE id NOT IN (SELECT id FROM users);
