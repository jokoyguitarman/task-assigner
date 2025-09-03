-- Simple fix for infinite recursion without complex JWT parsing
-- This removes all recursive policies and creates basic, working ones

-- Disable RLS temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can read based on role" ON public.users;
DROP POLICY IF EXISTS "Admin can create users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user lookup by ID" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;
DROP POLICY IF EXISTS "Simple admin and self access" ON public.users;
DROP POLICY IF EXISTS "Allow admin operations" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated user creation" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies without recursion

-- 1. Allow users to view their own profile
CREATE POLICY "view_own_profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- 2. Allow users to update their own profile  
CREATE POLICY "update_own_profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 3. Allow service role full access (for triggers, admin operations)
CREATE POLICY "service_role_access" ON public.users
    FOR ALL USING (current_setting('role') = 'service_role');

-- 4. Allow authenticated users to insert their own record (for signup)
CREATE POLICY "insert_own_profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- For now, we'll handle admin operations through the service role
-- This avoids the infinite recursion issue completely

-- Temporary solution: Allow all authenticated users to read all user profiles
-- This is less secure but will make the app work while we implement proper admin checks
CREATE POLICY "authenticated_read_all" ON public.users
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Show current policies
SELECT 
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

SELECT 'Simple RLS policies created - no more infinite recursion!' as status;
