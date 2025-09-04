-- Create sample staff profiles if they don't exist
-- First, let's create some staff positions if they don't exist
INSERT INTO staff_positions (id, name, description, created_at, updated_at)
VALUES 
  ('pos-manager-001', 'Manager', 'Store Manager', NOW(), NOW()),
  ('pos-cashier-001', 'Cashier', 'Cashier', NOW(), NOW()),
  ('pos-cook-001', 'Cook', 'Kitchen Staff', NOW(), NOW()),
  ('pos-server-001', 'Server', 'Wait Staff', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create sample staff profiles
-- Note: You'll need to replace these user IDs with actual user IDs from your users table
INSERT INTO staff_profiles (id, user_id, position_id, employee_id, hire_date, is_active, created_at, updated_at)
VALUES 
  ('staff-001', '7df0cde8-a5c6-4ce2-8743-c8910066578f', 'pos-manager-001', 'EMP001', '2024-01-01', true, NOW(), NOW()),
  ('staff-002', '7df0cde8-a5c6-4ce2-8743-c8910066578f', 'pos-cashier-001', 'EMP002', '2024-01-15', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Check what we created
SELECT 
  sp.id,
  sp.employee_id,
  sp.is_active,
  u.name as user_name,
  u.email as user_email,
  sp_pos.name as position_name
FROM staff_profiles sp
LEFT JOIN users u ON sp.user_id = u.id
LEFT JOIN staff_positions sp_pos ON sp.position_id = sp_pos.id
WHERE sp.is_active = true;
