-- Test authentication status and RLS
SELECT 
  'auth.uid()' as function_name, 
  auth.uid() as result
UNION ALL
SELECT 
  'auth.role()' as function_name, 
  auth.role()::text as result
UNION ALL
SELECT 
  'is_admin()' as function_name, 
  public.is_admin()::text as result
UNION ALL
SELECT 
  'is_outlet_user()' as function_name, 
  public.is_outlet_user()::text as result
UNION ALL
SELECT 
  'is_staff_user()' as function_name, 
  public.is_staff_user()::text as result;

-- Test direct data access without RLS
SELECT 'Direct staff_profiles count' as test, COUNT(*) as count FROM public.staff_profiles;
SELECT 'Direct users count' as test, COUNT(*) as count FROM public.users;
