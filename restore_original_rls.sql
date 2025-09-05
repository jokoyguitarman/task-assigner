-- Restore RLS with the original working approach
-- This mimics what was working before the changes

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules', 'invitations')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Create policies that allow admin users full access
-- Users table
CREATE POLICY "Admin full access users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Tasks table  
CREATE POLICY "Admin full access tasks" ON tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Task assignments table
CREATE POLICY "Admin full access assignments" ON task_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Staff profiles table
CREATE POLICY "Admin full access staff profiles" ON staff_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Outlets table
CREATE POLICY "Admin full access outlets" ON outlets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Monthly schedules table
CREATE POLICY "Admin full access monthly schedules" ON monthly_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Daily schedules table
CREATE POLICY "Admin full access daily schedules" ON daily_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Invitations table - allow public read for signup
CREATE POLICY "Public read invitations" ON invitations
  FOR SELECT USING (true);

CREATE POLICY "Admin full access invitations" ON invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Add outlet user access
CREATE POLICY "Outlet users access staff profiles" ON staff_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'outlet'
    )
  );

CREATE POLICY "Outlet users access assignments" ON task_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'outlet'
    )
  );

-- Add staff user access
CREATE POLICY "Staff users access own profile" ON staff_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Staff users access own assignments" ON task_assignments
  FOR SELECT USING (
    staff_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid())
  );

SELECT 'RLS restored with original working approach' as status;
