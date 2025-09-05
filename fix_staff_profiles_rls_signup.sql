-- Fix staff_profiles table RLS policies to allow signup process
-- The signup process needs to create staff profile records

-- First, let's see the current RLS policies on staff_profiles table
SELECT 
    policyname, 
    cmd, 
    roles, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'staff_profiles'
ORDER BY policyname;

-- Check if RLS is enabled on staff_profiles table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'staff_profiles';

-- Add a policy to allow staff profile creation during signup
CREATE POLICY "Allow staff profile creation during signup" ON staff_profiles
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Also allow reading staff profiles for authenticated users
CREATE POLICY "Allow authenticated read staff profiles" ON staff_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Test if the policy works by checking current staff profile count
SELECT COUNT(*) as staff_profile_count FROM staff_profiles;
