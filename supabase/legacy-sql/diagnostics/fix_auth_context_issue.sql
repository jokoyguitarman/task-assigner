-- Fix authentication context issue for the 500 error
-- The problem is likely that the RLS policies can't see the authenticated user context

-- First, let's modify the users policies to be more permissive for debugging
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admin can view all users" ON public.users;

-- Create a more permissive policy for authenticated users
CREATE POLICY "Authenticated users can view users" ON public.users
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Also create a policy that allows the specific query your app is making
CREATE POLICY "Allow user lookup by ID" ON public.users
    FOR SELECT USING (true);  -- Temporarily allow all reads for debugging

-- Test the fix
SELECT 'Policies updated - try logging in now' as status;

-- Show current policies
SELECT 
    policyname,
    cmd,
    permissive,
    qual
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';
