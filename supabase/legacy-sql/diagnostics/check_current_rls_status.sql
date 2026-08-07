-- Check current RLS status and policies
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('users', 'staff_profiles', 'tasks', 'task_assignments', 'outlets')
ORDER BY tablename;

-- Check what policies exist for staff_profiles
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'staff_profiles'
ORDER BY policyname;

-- Test direct access to staff_profiles
SELECT 'staff_profiles_count' as table_name, COUNT(*) as count FROM public.staff_profiles;

-- Check current user context
SELECT 
  'auth_context' as check_type,
  auth.uid() as current_user_id,
  auth.role() as current_role,
  public.is_admin() as is_admin_check;
