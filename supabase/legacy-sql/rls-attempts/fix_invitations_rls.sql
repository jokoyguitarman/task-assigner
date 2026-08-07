-- Fix RLS policies for invitations table
-- Allow admin users to create, read, update, and delete invitations

-- First, check if the invitations table exists and its current policies
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
WHERE tablename = 'invitations';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage all invitations" ON invitations;
DROP POLICY IF EXISTS "Users can view their own invitations" ON invitations;
DROP POLICY IF EXISTS "Users can update their own invitations" ON invitations;

-- Create comprehensive RLS policies for invitations
CREATE POLICY "Admin can manage all invitations" ON invitations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Allow users to view invitations sent to them
CREATE POLICY "Users can view invitations sent to them" ON invitations
    FOR SELECT
    TO authenticated
    USING (
        email = (
            SELECT email FROM users 
            WHERE users.id = auth.uid()
        )
    );

-- Allow users to update their own invitation status (accept/decline)
CREATE POLICY "Users can update their own invitations" ON invitations
    FOR UPDATE
    TO authenticated
    USING (
        email = (
            SELECT email FROM users 
            WHERE users.id = auth.uid()
        )
    )
    WITH CHECK (
        email = (
            SELECT email FROM users 
            WHERE users.id = auth.uid()
        )
    );

-- Ensure RLS is enabled on the invitations table
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created
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
