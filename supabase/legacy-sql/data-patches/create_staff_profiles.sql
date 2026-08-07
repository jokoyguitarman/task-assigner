-- Create staff profiles for existing users
-- First, let's see what users we have
SELECT 
  id,
  name,
  email,
  role,
  created_at
FROM users
ORDER BY created_at DESC;

-- Now let's create staff profiles for the users
-- You'll need to replace these user IDs with actual ones from your users table

-- For the outlet user (Cucina Mabini)
INSERT INTO staff_profiles (id, user_id, position_id, employee_id, hire_date, is_active, created_at)
VALUES 
  -- Replace 'USER_ID_HERE' with the actual user ID from your users table
  ('staff-outlet-001', 'USER_ID_HERE', '7a98b170-391d-436f-a1b7-92d52d12f32a', 'OUT001', '2024-01-01', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- If you have other users, create staff profiles for them too
-- Example for admin user:
-- INSERT INTO staff_profiles (id, user_id, position_id, employee_id, hire_date, is_active, created_at)
-- VALUES 
--   ('staff-admin-001', 'ADMIN_USER_ID_HERE', '7a98b170-391d-436f-a1b7-92d52d12f32a', 'ADM001', '2024-01-01', true, NOW())
-- ON CONFLICT (id) DO NOTHING;

-- After creating staff profiles, check what we have
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
