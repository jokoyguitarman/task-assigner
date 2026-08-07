-- Debug invitation token issue
-- Check the invitation data and token format

-- First, let's see all invitations and their tokens
SELECT 
    id,
    email,
    token,
    role,
    outlet_id,
    created_at,
    expires_at,
    used_at,
    CASE 
        WHEN used_at IS NOT NULL THEN 'USED'
        WHEN expires_at < NOW() THEN 'EXPIRED'
        ELSE 'VALID'
    END as status
FROM invitations
ORDER BY created_at DESC;

-- Check if there are any RLS policies blocking the token lookup
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'invitations'
ORDER BY policyname;

-- Test a specific token lookup (replace with your actual token)
-- SELECT * FROM invitations WHERE token = 'YOUR_TOKEN_HERE';
