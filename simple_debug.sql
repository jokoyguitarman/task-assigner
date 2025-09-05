-- Simple debug script to check what's happening

-- Check if we can access data at all
SELECT 'Checking data access...' as step;

-- Try to count records in each table
SELECT 'users' as table_name, COUNT(*) as count FROM users;
SELECT 'tasks' as table_name, COUNT(*) as count FROM tasks;
SELECT 'task_assignments' as table_name, COUNT(*) as count FROM task_assignments;
SELECT 'staff_profiles' as table_name, COUNT(*) as count FROM staff_profiles;
SELECT 'outlets' as table_name, COUNT(*) as count FROM outlets;

-- Check current user
SELECT 'Current user check...' as step;
SELECT auth.uid() as user_id;

-- Check if RLS is enabled (simple way)
SELECT 'RLS check...' as step;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';

-- Check policies
SELECT 'Policy check...' as step;
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';

SELECT 'Debug complete' as status;
