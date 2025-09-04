-- Automatically create staff profiles for all existing users
-- This script will create a staff profile for each user with a default position

-- Create staff profiles for all users
INSERT INTO staff_profiles (id, user_id, position_id, employee_id, hire_date, is_active, created_at)
SELECT 
  gen_random_uuid() as id,
  u.id as user_id,
  CASE 
    WHEN u.role = 'admin' THEN '7a98b170-391d-436f-a1b7-92d52d12f32a' -- Manager
    WHEN u.role = 'outlet' THEN '7a98b170-391d-436f-a1b7-92d52d12f32a' -- Manager
    ELSE '7a98b170-391d-436f-a1b7-92d52d12f32a' -- Default to Manager
  END as position_id,
  'EMP-' || SUBSTRING(u.id::text, 1, 8) as employee_id,
  u.created_at as hire_date,
  true as is_active,
  NOW() as created_at
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM staff_profiles sp WHERE sp.user_id = u.id
);

-- Check what we created
SELECT 
  sp.id,
  sp.employee_id,
  sp.is_active,
  u.name as user_name,
  u.email as user_email,
  u.role as user_role,
  sp_pos.name as position_name
FROM staff_profiles sp
LEFT JOIN users u ON sp.user_id = u.id
LEFT JOIN staff_positions sp_pos ON sp.position_id = sp_pos.id
WHERE sp.is_active = true
ORDER BY sp.created_at DESC;
