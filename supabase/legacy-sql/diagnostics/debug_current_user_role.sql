-- Debug current user role and RLS policies
-- This will help us understand why the assignment creation is failing

-- 1. Check current user and their role
SELECT 
    id,
    email,
    name,
    role,
    organization_id,
    is_primary_admin
FROM public.users 
WHERE id = auth.uid();

-- 2. Check if the user exists in the users table
SELECT COUNT(*) as user_exists
FROM public.users 
WHERE id = auth.uid();

-- 3. Check all RLS policies on task_assignments
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies 
WHERE tablename = 'task_assignments' 
AND schemaname = 'public'
ORDER BY policyname;

-- 4. Test if the admin policy works
SELECT 
    'Admin policy test' as test_name,
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    ) as is_admin;

-- 5. Check if there are any assignments in the table
SELECT COUNT(*) as total_assignments FROM task_assignments;
