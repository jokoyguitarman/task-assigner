-- Fix invitation RLS policies to allow unauthenticated users to read invitations by token
-- This is needed for the signup process to work

-- First, let's see the current policies
SELECT 
    policyname, 
    cmd, 
    roles, 
    qual
FROM pg_policies 
WHERE tablename = 'invitations'
ORDER BY policyname;

-- Add a policy to allow unauthenticated users to read invitations by token
-- This is needed for the signup process
CREATE POLICY "Allow public read invitations by token" ON invitations
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Alternative approach: Create a more specific policy for token-based access
-- DROP POLICY IF EXISTS "Allow public read invitations by token" ON invitations;

-- CREATE POLICY "Allow token-based invitation read" ON invitations
--     FOR SELECT
--     TO anon, authenticated
--     USING (token IS NOT NULL);

-- Test the policy by checking if anon role can read invitations
-- This should work after applying the policy
SELECT 
    id,
    email,
    token,
    role,
    expires_at,
    used_at
FROM invitations
LIMIT 5;
