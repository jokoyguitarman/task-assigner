-- Check what data exists in the database
-- This will help us identify if the issue is with RLS policies or missing data

-- Check users table
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
-- Check tasks table  
SELECT 'tasks' as table_name, COUNT(*) as count FROM tasks
UNION ALL
-- Check task_assignments table
SELECT 'task_assignments' as table_name, COUNT(*) as count FROM task_assignments
UNION ALL
-- Check staff_profiles table
SELECT 'staff_profiles' as table_name, COUNT(*) as count FROM staff_profiles
UNION ALL
-- Check outlets table
SELECT 'outlets' as table_name, COUNT(*) as count FROM outlets
UNION ALL
-- Check monthly_schedules table
SELECT 'monthly_schedules' as table_name, COUNT(*) as count FROM monthly_schedules
UNION ALL
-- Check daily_schedules table
SELECT 'daily_schedules' as table_name, COUNT(*) as count FROM daily_schedules;

-- Check if there are any RLS policies blocking access
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules')
ORDER BY tablename, policyname;

-- Check if RLS is enabled on these tables
SELECT schemaname, tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules')
ORDER BY tablename;
