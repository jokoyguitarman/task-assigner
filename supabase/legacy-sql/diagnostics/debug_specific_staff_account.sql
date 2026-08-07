-- Debug specific staff account that's not showing data
SELECT 'Current user context:' as check_type, 
       auth.uid() as current_user_id,
       auth.role() as current_role;

-- Check the specific staff user's details
SELECT 'Staff user details:' as check_type,
       u.id,
       u.email,
       u.name,
       u.role,
       u.organization_id,
       u.is_primary_admin,
       u.created_at
FROM users u 
WHERE u.id = auth.uid();

-- Check if the staff user has a staff profile
SELECT 'Staff profile check:' as check_type,
       sp.id,
       sp.user_id,
       sp.employee_id,
       sp.position_id,
       sp.organization_id,
       sp.is_active,
       sp.hire_date
FROM staff_profiles sp
WHERE sp.user_id = auth.uid();

-- Check if the staff user's organization exists and is accessible
SELECT 'Organization check:' as check_type,
       o.id,
       o.name,
       o.subscription_tier,
       o.max_admins,
       o.max_restaurants,
       o.max_employees
FROM organizations o
WHERE o.id = (SELECT organization_id FROM users WHERE id = auth.uid());

-- Test the helper function
SELECT 'current_user_organization_id()' as function_name, 
       current_user_organization_id() as result;

-- Check if staff user can see tasks in their organization
SELECT 'Tasks in organization:' as check_type,
       COUNT(*) as task_count
FROM tasks 
WHERE organization_id = current_user_organization_id();

-- Check if staff user can see staff profiles in their organization
SELECT 'Staff profiles in organization:' as check_type,
       COUNT(*) as staff_count
FROM staff_profiles 
WHERE organization_id = current_user_organization_id();

-- Check if staff user can see outlets in their organization
SELECT 'Outlets in organization:' as check_type,
       COUNT(*) as outlet_count
FROM outlets 
WHERE organization_id = current_user_organization_id();

-- Check if staff user can see task assignments in their organization
SELECT 'Task assignments in organization:' as check_type,
       COUNT(*) as assignment_count
FROM task_assignments 
WHERE organization_id = current_user_organization_id();

-- Check if there are any task assignments specifically for this staff member
SELECT 'Task assignments for this staff:' as check_type,
       COUNT(*) as personal_assignment_count
FROM task_assignments ta
JOIN staff_profiles sp ON ta.staff_id = sp.id
WHERE sp.user_id = auth.uid();

-- Check if the staff user's organization_id is NULL or invalid
SELECT 'Organization ID validation:' as check_type,
       CASE 
         WHEN u.organization_id IS NULL THEN 'NULL organization_id'
         WHEN NOT EXISTS (SELECT 1 FROM organizations WHERE id = u.organization_id) THEN 'Invalid organization_id'
         ELSE 'Valid organization_id'
       END as status
FROM users u
WHERE u.id = auth.uid();
