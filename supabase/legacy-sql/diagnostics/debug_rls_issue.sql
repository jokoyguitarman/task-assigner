-- Debug RLS issues
-- This will help us understand what's blocking access

-- Check if RLS is enabled on tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules')
ORDER BY tablename;

-- Check what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules')
ORDER BY tablename, policyname;

-- Check if we can query the tables directly (this should work)
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'tasks' as table_name, COUNT(*) as count FROM tasks
UNION ALL
SELECT 'task_assignments' as table_name, COUNT(*) as count FROM task_assignments
UNION ALL
SELECT 'staff_profiles' as table_name, COUNT(*) as count FROM staff_profiles
UNION ALL
SELECT 'outlets' as table_name, COUNT(*) as count FROM outlets;

-- Check current user context
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role,
  current_user as postgres_user;

-- Test a simple policy
SELECT 'Testing policy access...' as test;
