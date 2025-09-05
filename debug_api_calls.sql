-- Test what data the staff user can actually see with current API calls
SELECT 'Current user context:' as check_type, 
       auth.uid() as current_user_id,
       auth.role() as current_role;

-- Test the exact queries that the frontend APIs are making
SELECT 'Tasks API - getAll()' as api_call, COUNT(*) as count FROM tasks;
SELECT 'Assignments API - getAll()' as api_call, COUNT(*) as count FROM task_assignments;
SELECT 'Users API - getAll()' as api_call, COUNT(*) as count FROM users;
SELECT 'Outlets API - getAll()' as api_call, COUNT(*) as count FROM outlets;
SELECT 'Staff Profiles API - getAll()' as api_call, COUNT(*) as count FROM staff_profiles;

-- Test with organization filtering (what the APIs should be doing)
SELECT 'Tasks with org filter' as api_call, COUNT(*) as count FROM tasks WHERE organization_id = current_user_organization_id();
SELECT 'Assignments with org filter' as api_call, COUNT(*) as count FROM task_assignments WHERE organization_id = current_user_organization_id();
SELECT 'Users with org filter' as api_call, COUNT(*) as count FROM users WHERE organization_id = current_user_organization_id();
SELECT 'Outlets with org filter' as api_call, COUNT(*) as count FROM outlets WHERE organization_id = current_user_organization_id();
SELECT 'Staff Profiles with org filter' as api_call, COUNT(*) as count FROM staff_profiles WHERE organization_id = current_user_organization_id();
