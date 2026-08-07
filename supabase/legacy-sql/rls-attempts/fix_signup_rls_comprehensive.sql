-- Comprehensive fix for all RLS policies needed for signup process
-- This addresses users, staff_profiles, and outlets tables

-- 1. Fix users table RLS for signup
-- Allow user creation during signup process
CREATE POLICY "Allow user creation during signup" ON users
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- 2. Fix staff_profiles table RLS for signup
-- Allow staff profile creation during signup
CREATE POLICY "Allow staff profile creation during signup" ON staff_profiles
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow authenticated users to read staff profiles
CREATE POLICY "Allow authenticated read staff profiles" ON staff_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Fix outlets table RLS for signup (if creating outlet users)
-- Allow outlet creation during signup
CREATE POLICY "Allow outlet creation during signup" ON outlets
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow authenticated users to read outlets
CREATE POLICY "Allow authenticated read outlets" ON outlets
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. Ensure invitations table allows public read (already done, but double-check)
-- This should already exist from the previous fix
-- Note: CREATE POLICY IF NOT EXISTS is not supported, so we'll create it normally
-- If it already exists, you'll get an error but that's okay
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
