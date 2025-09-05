-- Comprehensive diagnosis of staff profiles and user data issue

-- 1. Check if users table has data
SELECT 'users_table' as source, COUNT(*) as count FROM public.users;

-- 2. Check if staff_profiles table has data
SELECT 'staff_profiles_table' as source, COUNT(*) as count FROM public.staff_profiles;

-- 3. Check the actual user data
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.created_at
FROM public.users u
ORDER BY u.created_at DESC
LIMIT 10;

-- 4. Check staff profiles with their user_id references
SELECT 
  sp.id as staff_profile_id,
  sp.user_id,
  sp.employee_id,
  sp.is_active,
  u.name as user_name,
  u.email as user_email,
  u.role as user_role
FROM public.staff_profiles sp
LEFT JOIN public.users u ON sp.user_id = u.id
ORDER BY sp.created_at DESC
LIMIT 10;

-- 5. Check if there are orphaned staff profiles (user_id doesn't exist in users table)
SELECT 
  sp.id as staff_profile_id,
  sp.user_id,
  sp.employee_id,
  'ORPHANED - user_id not found in users table' as status
FROM public.staff_profiles sp
LEFT JOIN public.users u ON sp.user_id = u.id
WHERE u.id IS NULL;

-- 6. Check current authentication context
SELECT 
  'auth_context' as check_type,
  auth.uid() as current_user_id,
  auth.role() as current_role,
  public.is_admin() as is_admin_check;

-- 7. Test the exact query that staffProfilesAPI.getAll() uses
SELECT 
  sp.*,
  u.name as user_name,
  u.email as user_email,
  u.role as user_role,
  sp2.name as position_name
FROM public.staff_profiles sp
LEFT JOIN public.users u ON sp.user_id = u.id
LEFT JOIN public.staff_positions sp2 ON sp.position_id = sp2.id
ORDER BY sp.created_at DESC
LIMIT 5;
