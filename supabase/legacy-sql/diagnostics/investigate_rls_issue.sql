-- Investigate what's causing RLS to block access
-- Let's check what was working before vs now

-- Check current RLS status
SELECT 
  tablename, 
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables 
WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules', 'invitations')
ORDER BY tablename;

-- Check what policies exist
SELECT 
  tablename, 
  policyname, 
  cmd as operation,
  permissive,
  roles
FROM pg_policies 
WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules', 'invitations')
ORDER BY tablename, policyname;

-- Test if we can access data with current setup
SELECT 'Testing data access...' as test;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as task_count FROM tasks;
SELECT COUNT(*) as assignment_count FROM task_assignments;

-- Check if there are any triggers that might be interfering
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets')
ORDER BY event_object_table, trigger_name;
