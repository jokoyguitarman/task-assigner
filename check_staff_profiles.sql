-- Check if there are any staff profiles in the database
SELECT 
  sp.id,
  sp.employee_id,
  sp.is_active,
  sp.created_at,
  u.name as user_name,
  u.email as user_email,
  sp_pos.name as position_name
FROM staff_profiles sp
LEFT JOIN users u ON sp.user_id = u.id
LEFT JOIN staff_positions sp_pos ON sp.position_id = sp_pos.id
ORDER BY sp.created_at DESC;

-- Check if there are any users in the database
SELECT 
  id,
  name,
  email,
  role,
  created_at
FROM users
ORDER BY created_at DESC;

-- Check if there are any staff positions
SELECT 
  id,
  name,
  description,
  created_at
FROM staff_positions
ORDER BY created_at DESC;
