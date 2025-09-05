-- Diagnose organization RLS issues
SELECT 'Current user context:' as check_type, 
       auth.uid() as current_user_id,
       auth.role() as current_role;

-- Check if helper functions work
SELECT 'Testing helper functions:' as check_type;

SELECT 'current_user_organization_id()' as function_name, 
       current_user_organization_id() as result;

-- Check if user has organization_id set
SELECT 'User organization check:' as check_type,
       u.id,
       u.email,
       u.role,
       u.organization_id,
       u.is_primary_admin
FROM users u 
WHERE u.id = auth.uid();

-- Check organization data
SELECT 'Organization data:' as check_type,
       o.id,
       o.name,
       o.subscription_tier,
       o.max_admins,
       o.max_restaurants,
       o.max_employees
FROM organizations o
WHERE o.id = current_user_organization_id();

-- Test if we can see any data with current policies
SELECT 'Data visibility test:' as check_type;

SELECT 'Users count:' as table_name, COUNT(*) as count FROM users;
SELECT 'Staff profiles count:' as table_name, COUNT(*) as count FROM staff_profiles;
SELECT 'Tasks count:' as table_name, COUNT(*) as count FROM tasks;
SELECT 'Outlets count:' as table_name, COUNT(*) as count FROM outlets;
SELECT 'Task assignments count:' as table_name, COUNT(*) as count FROM task_assignments;

-- Check RLS status
SELECT 'RLS status:' as check_type,
       schemaname,
       tablename,
       rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'staff_profiles', 'tasks', 'outlets', 'task_assignments', 'organizations')
ORDER BY tablename;
