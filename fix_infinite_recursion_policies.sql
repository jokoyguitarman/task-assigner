-- Fix infinite recursion in RLS policies
-- The issue is that our policies are checking the users table from within the users table policies

-- First, disable RLS on users table temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can read based on role" ON public.users;
DROP POLICY IF EXISTS "Admin can create users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user lookup by ID" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies

-- 1. Allow users to read their own profile (no recursion)
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- 2. Allow users to update their own profile (no recursion)
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 3. Allow authenticated users to insert (for signup process)
CREATE POLICY "Allow authenticated user creation" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Allow service role full access (for triggers and admin operations)
CREATE POLICY "Service role full access" ON public.users
    FOR ALL USING (current_setting('role') = 'service_role');

-- 5. Simple admin policy - we'll use a different approach
-- Instead of checking the users table, we'll check the JWT claims or use a simpler method
CREATE POLICY "Allow admin operations" ON public.users
    FOR ALL USING (
        -- Allow if the user is trying to access their own record
        auth.uid() = id
        OR
        -- Allow service role
        current_setting('role') = 'service_role'
        OR
        -- Allow if user has admin role in JWT (this avoids recursion)
        (auth.jwt() ->> 'user_metadata' ->> 'role') = 'admin'
    );

-- Alternative approach: Create a function to check admin role without recursion
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- This function will be called with SECURITY DEFINER to bypass RLS
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the problematic policy and create a better one
DROP POLICY IF EXISTS "Allow admin operations" ON public.users;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "Simple admin and self access" ON public.users
    FOR ALL USING (
        -- Users can access their own records
        auth.uid() = id
        OR
        -- Service role can access everything
        current_setting('role') = 'service_role'
    );

-- For admin operations, we'll rely on the application layer and service role
-- Remove the recursive admin check for now

-- Show current policies
SELECT 
    policyname,
    cmd,
    permissive,
    with_check,
    qual
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

SELECT 'Infinite recursion policies fixed! Admin operations will work through service role.' as status;
