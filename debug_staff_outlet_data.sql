-- Debug staff/outlet data access issues
SELECT 'Current user context:' as check_type, 
       auth.uid() as current_user_id,
       auth.role() as current_role;

-- Check if user has organization_id set
SELECT 'User organization check:' as check_type,
       u.id,
       u.email,
       u.role,
       u.organization_id,
       u.is_primary_admin
FROM users u 
WHERE u.id = auth.uid();

-- Test helper function
SELECT 'current_user_organization_id()' as function_name, 
       current_user_organization_id() as result;

-- Check if user can see their organization
SELECT 'Organization access:' as check_type,
       o.id,
       o.name,
       o.subscription_tier
FROM organizations o
WHERE o.id = current_user_organization_id();

-- Test data visibility with current user context
SELECT 'Data visibility test:' as check_type;

-- Check if user can see tasks
SELECT 'Tasks count:' as table_name, COUNT(*) as count FROM tasks;
SELECT 'Tasks with org filter:' as table_name, COUNT(*) as count FROM tasks WHERE organization_id = current_user_organization_id();

-- Check if user can see staff profiles
SELECT 'Staff profiles count:' as table_name, COUNT(*) as count FROM staff_profiles;
SELECT 'Staff profiles with org filter:' as table_name, COUNT(*) as count FROM staff_profiles WHERE organization_id = current_user_organization_id();

-- Check if user can see outlets
SELECT 'Outlets count:' as table_name, COUNT(*) as count FROM outlets;
SELECT 'Outlets with org filter:' as table_name, COUNT(*) as count FROM outlets WHERE organization_id = current_user_organization_id();

-- Check if user can see task assignments
SELECT 'Task assignments count:' as table_name, COUNT(*) as count FROM task_assignments;
SELECT 'Task assignments with org filter:' as table_name, COUNT(*) as count FROM task_assignments WHERE organization_id = current_user_organization_id();

-- Check RLS status
SELECT 'RLS status:' as check_type,
       schemaname,
       tablename,
       rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'staff_profiles', 'tasks', 'outlets', 'task_assignments', 'organizations')
ORDER BY tablename;

-- Check if policies exist
SELECT 'RLS policies:' as check_type,
       schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'staff_profiles', 'tasks', 'outlets', 'task_assignments', 'organizations')
ORDER BY tablename, policyname;