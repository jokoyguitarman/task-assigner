-- Delete placeholder staff accounts
-- This script will help you remove placeholder/demo staff accounts

-- First, let's see what staff accounts exist
SELECT 
    sp.id,
    u.name,
    u.email,
    p.name as position_name,
    sp.employee_id,
    sp.created_at
FROM public.staff_profiles sp
JOIN public.users u ON sp.user_id = u.id
LEFT JOIN public.staff_positions p ON sp.position_id = p.id
ORDER BY sp.created_at;

-- If you want to delete ALL staff profiles and their associated users:
-- WARNING: This will delete ALL staff data. Only run if you're sure!

-- First delete staff profiles (this removes the staff-specific data)
-- DELETE FROM public.staff_profiles;

-- Then delete users with 'staff' role (this removes the user accounts)
-- DELETE FROM public.users WHERE role = 'staff';

-- If you want to delete specific staff members, use their IDs:
-- Replace 'STAFF_PROFILE_ID_HERE' with the actual ID from the SELECT query above

-- Example: Delete a specific staff profile and its user
-- DELETE FROM public.staff_profiles WHERE id = 'STAFF_PROFILE_ID_HERE';
-- DELETE FROM public.users WHERE id = 'USER_ID_HERE' AND role = 'staff';

-- If you want to keep the user accounts but just remove their staff profile:
-- DELETE FROM public.staff_profiles WHERE id = 'STAFF_PROFILE_ID_HERE';

-- To delete all staff except a specific one (replace with actual employee_id):
-- DELETE FROM public.staff_profiles WHERE employee_id != 'KEEP_THIS_EMPLOYEE_ID';

-- Reset the database sequences if you deleted everything:
-- This ensures new staff IDs start from 1 again
-- SELECT setval('staff_profiles_id_seq', 1, false);
