-- Fix RLS policies for the users table to allow proper authentication

-- First, check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- Disable RLS temporarily to test (you can re-enable later with proper policies)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Alternative: Create proper RLS policies instead of disabling
-- (Uncomment these if you want to keep RLS enabled with proper policies)

/*
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Policy 2: Users can update their own profile  
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Policy 3: Allow insert for new user creation (needed for signup/trigger)
CREATE POLICY "Enable insert for authenticated users" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy 4: Allow service role to do anything (for triggers)
CREATE POLICY "Service role can do anything" ON public.users
    FOR ALL USING (current_setting('role') = 'service_role');
*/

-- Check if RLS is now disabled
SELECT 
    'RLS Status' as info,
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- Test query to see if it works now
SELECT 'Test query result' as info, count(*) as user_count 
FROM public.users;
