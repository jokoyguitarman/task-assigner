-- Fix RLS policies for outlets table
-- Allow admin users to manage outlets

-- First, check current RLS policies on outlets table
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
WHERE tablename = 'outlets'
ORDER BY policyname;

-- Check if RLS is enabled on outlets
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'outlets';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage all outlets" ON outlets;
DROP POLICY IF EXISTS "Users can view outlets" ON outlets;
DROP POLICY IF EXISTS "Outlet users can view their outlet" ON outlets;

-- Create comprehensive RLS policies for outlets
CREATE POLICY "Admin can manage all outlets" ON outlets
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

-- Allow all authenticated users to view outlets (for dropdowns, etc.)
CREATE POLICY "Users can view outlets" ON outlets
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow outlet users to view their specific outlet
CREATE POLICY "Outlet users can view their outlet" ON outlets
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT outlet_id FROM staff_profiles 
            WHERE user_id = auth.uid()
        )
    );

-- Ensure RLS is enabled on the outlets table
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

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
WHERE tablename = 'outlets'
ORDER BY policyname;
