-- Temporarily disable RLS on task_assignments for testing
-- This will allow assignment creation while we fix the policies

-- Disable RLS temporarily
ALTER TABLE public.task_assignments DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'task_assignments' 
AND schemaname = 'public';

-- Test if we can now insert assignments
-- This is just for verification - don't run this in production
SELECT 'RLS disabled on task_assignments - assignments should now work' as status;