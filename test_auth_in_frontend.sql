-- Test if frontend authentication is working
-- This should be run from the frontend, not SQL editor

-- Check current user context from frontend
SELECT 
  'frontend_auth_test' as test_type,
  auth.uid() as current_user_id,
  auth.role() as current_role,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'AUTHENTICATED'
    ELSE 'NOT_AUTHENTICATED'
  END as auth_status;

-- Test if we can access staff_profiles with current auth
SELECT 
  'staff_profiles_access_test' as test_type,
  COUNT(*) as staff_count
FROM public.staff_profiles;

-- Test if we can access users with current auth  
SELECT 
  'users_access_test' as test_type,
  COUNT(*) as user_count
FROM public.users;
