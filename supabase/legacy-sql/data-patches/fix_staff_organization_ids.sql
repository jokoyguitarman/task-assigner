-- Fix staff users and profiles that don't have organization_id set

-- First, let's see what we're working with
SELECT 'Before fix - Users without organization_id:' as check_type, COUNT(*) as count 
FROM users 
WHERE organization_id IS NULL;

SELECT 'Before fix - Staff profiles without organization_id:' as check_type, COUNT(*) as count 
FROM staff_profiles 
WHERE organization_id IS NULL;

-- Update users that don't have organization_id (should be none, but just in case)
UPDATE users 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Update staff profiles that don't have organization_id
UPDATE staff_profiles 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Update tasks that don't have organization_id
UPDATE tasks 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Update task assignments that don't have organization_id
UPDATE task_assignments 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Update outlets that don't have organization_id
UPDATE outlets 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Update monthly schedules that don't have organization_id
UPDATE monthly_schedules 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Update daily schedules that don't have organization_id
UPDATE daily_schedules 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Update invitations that don't have organization_id
UPDATE invitations 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Check after fix
SELECT 'After fix - Users without organization_id:' as check_type, COUNT(*) as count 
FROM users 
WHERE organization_id IS NULL;

SELECT 'After fix - Staff profiles without organization_id:' as check_type, COUNT(*) as count 
FROM staff_profiles 
WHERE organization_id IS NULL;

-- Test the current user's data access after fix
SELECT 'Current user can now see:' as check_type;
SELECT 'Tasks:' as table_name, COUNT(*) as count FROM tasks WHERE organization_id = current_user_organization_id();
SELECT 'Staff Profiles:' as table_name, COUNT(*) as count FROM staff_profiles WHERE organization_id = current_user_organization_id();
SELECT 'Outlets:' as table_name, COUNT(*) as count FROM outlets WHERE organization_id = current_user_organization_id();
SELECT 'Task Assignments:' as table_name, COUNT(*) as count FROM task_assignments WHERE organization_id = current_user_organization_id();

SELECT 'Organization ID fix completed successfully.' as status;
