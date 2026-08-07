-- Test what happens when we run the exact same queries the frontend APIs use
SELECT 'Testing API queries with current user context:' as test_type;

-- Test the exact query that tasksAPI.getAll() uses
SELECT 'tasksAPI.getAll() result:' as api_name, COUNT(*) as count 
FROM tasks;

-- Test the exact query that assignmentsAPI.getAll() uses  
SELECT 'assignmentsAPI.getAll() result:' as api_name, COUNT(*) as count 
FROM task_assignments;

-- Test the exact query that staffProfilesAPI.getAll() uses
SELECT 'staffProfilesAPI.getAll() result:' as api_name, COUNT(*) as count 
FROM staff_profiles;

-- Test the exact query that outletsAPI.getAll() uses
SELECT 'outletsAPI.getAll() result:' as api_name, COUNT(*) as count 
FROM outlets;

-- Test the exact query that usersAPI.getAll() uses
SELECT 'usersAPI.getAll() result:' as api_name, COUNT(*) as count 
FROM users;

-- Now test with organization filtering (what should work)
SELECT 'With organization filter:' as test_type;
SELECT 'Tasks in org:' as api_name, COUNT(*) as count 
FROM tasks WHERE organization_id = current_user_organization_id();

SELECT 'Assignments in org:' as api_name, COUNT(*) as count 
FROM task_assignments WHERE organization_id = current_user_organization_id();

SELECT 'Staff profiles in org:' as api_name, COUNT(*) as count 
FROM staff_profiles WHERE organization_id = current_user_organization_id();

SELECT 'Outlets in org:' as api_name, COUNT(*) as count 
FROM outlets WHERE organization_id = current_user_organization_id();

SELECT 'Users in org:' as api_name, COUNT(*) as count 
FROM users WHERE organization_id = current_user_organization_id();
