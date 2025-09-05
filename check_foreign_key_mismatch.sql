-- Check if staff_profiles.user_id matches users.id
SELECT 
  'Foreign Key Check' as check_type,
  COUNT(*) as total_staff_profiles,
  COUNT(u.id) as profiles_with_matching_users,
  COUNT(*) - COUNT(u.id) as orphaned_profiles
FROM public.staff_profiles sp
LEFT JOIN public.users u ON sp.user_id = u.id;

-- Show specific examples of the mismatch
SELECT 
  sp.id as staff_profile_id,
  sp.user_id as staff_user_id,
  sp.employee_id,
  u.id as actual_user_id,
  u.name as user_name,
  CASE 
    WHEN u.id IS NULL THEN 'MISSING USER'
    WHEN sp.user_id = u.id THEN 'MATCH'
    ELSE 'MISMATCH'
  END as status
FROM public.staff_profiles sp
LEFT JOIN public.users u ON sp.user_id = u.id
ORDER BY sp.created_at DESC
LIMIT 10;

-- Check if there are any users that should be linked to staff profiles
SELECT 
  u.id as user_id,
  u.name,
  u.email,
  u.role,
  sp.id as staff_profile_id,
  sp.employee_id,
  CASE 
    WHEN sp.id IS NULL THEN 'NO STAFF PROFILE'
    ELSE 'HAS STAFF PROFILE'
  END as status
FROM public.users u
LEFT JOIN public.staff_profiles sp ON u.id = sp.user_id
WHERE u.role = 'staff'
ORDER BY u.created_at DESC
LIMIT 10;
