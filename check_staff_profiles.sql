-- Check staff profiles and their user data
SELECT 
  sp.id,
  sp.employee_id,
  sp.is_active,
  u.name as user_name,
  u.email as user_email,
  u.role as user_role,
  sp2.name as position_name
FROM public.staff_profiles sp
LEFT JOIN public.users u ON sp.user_id = u.id
LEFT JOIN public.staff_positions sp2 ON sp.position_id = sp2.id
ORDER BY sp.created_at DESC;

-- Check if RLS is blocking staff profiles
SELECT 'staff_profiles' as table_name, COUNT(*) as count FROM public.staff_profiles;
SELECT 'users' as table_name, COUNT(*) as count FROM public.users;
SELECT 'staff_positions' as table_name, COUNT(*) as count FROM public.staff_positions;

-- Check current user context
SELECT auth.uid() as current_user_id, (SELECT role FROM public.users WHERE id = auth.uid()) as current_user_role;