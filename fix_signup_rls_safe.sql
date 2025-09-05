-- Safe fix for all RLS policies needed for signup process
-- This handles existing policies properly

-- 1. Fix users table RLS for signup
-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Allow user creation during signup" ON users;
CREATE POLICY "Allow user creation during signup" ON users
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- 2. Fix staff_profiles table RLS for signup
-- Allow staff profile creation during signup
DROP POLICY IF EXISTS "Allow staff profile creation during signup" ON staff_profiles;
CREATE POLICY "Allow staff profile creation during signup" ON staff_profiles
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow authenticated users to read staff profiles
DROP POLICY IF EXISTS "Allow authenticated read staff profiles" ON staff_profiles;
CREATE POLICY "Allow authenticated read staff profiles" ON staff_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Fix outlets table RLS for signup (if creating outlet users)
-- Allow outlet creation during signup
DROP POLICY IF EXISTS "Allow outlet creation during signup" ON outlets;
CREATE POLICY "Allow outlet creation during signup" ON outlets
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow authenticated users to read outlets
DROP POLICY IF EXISTS "Allow authenticated read outlets" ON outlets;
CREATE POLICY "Allow authenticated read outlets" ON outlets
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. Ensure invitations table allows public read
-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Allow public read invitations by token" ON invitations;
CREATE POLICY "Allow public read invitations by token" ON invitations
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Test the policies by checking table access
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'staff_profiles' as table_name, COUNT(*) as record_count FROM staff_profiles
UNION ALL
SELECT 'outlets' as table_name, COUNT(*) as record_count FROM outlets
UNION ALL
SELECT 'invitations' as table_name, COUNT(*) as record_count FROM invitations;
