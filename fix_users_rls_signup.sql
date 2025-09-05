-- Fix users table RLS policies to allow signup process
-- The signup process needs to create user records

-- First, let's see the current RLS policies on users table
SELECT 
    policyname, 
    cmd, 
    roles, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Check if RLS is enabled on users table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users';

-- Add a policy to allow user creation during signup
-- This allows the signup process to insert new user records
CREATE POLICY "Allow user creation during signup" ON users
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Alternative: More restrictive policy that only allows specific fields
-- DROP POLICY IF EXISTS "Allow user creation during signup" ON users;
-- CREATE POLICY "Allow user creation during signup" ON users
--     FOR INSERT
--     TO anon, authenticated
--     WITH CHECK (
--         id IS NOT NULL AND
--         email IS NOT NULL AND
--         name IS NOT NULL AND
--         role IN ('staff', 'outlet', 'admin')
--     );

-- Test if the policy works by checking current user count
SELECT COUNT(*) as user_count FROM users;
