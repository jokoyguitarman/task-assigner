-- Enable RLS with admin-only access
-- This will show exactly what admins can access

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

-- Create admin-only policies for each table

-- USERS TABLE - Admin can do everything
CREATE POLICY "Admin full access to users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- TASKS TABLE - Admin can do everything  
CREATE POLICY "Admin full access to tasks" ON tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- TASK_ASSIGNMENTS TABLE - Admin can do everything
CREATE POLICY "Admin full access to assignments" ON task_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- STAFF_PROFILES TABLE - Admin can do everything
CREATE POLICY "Admin full access to staff profiles" ON staff_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- OUTLETS TABLE - Admin can do everything
CREATE POLICY "Admin full access to outlets" ON outlets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- MONTHLY_SCHEDULES TABLE - Admin can do everything
CREATE POLICY "Admin full access to monthly schedules" ON monthly_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- DAILY_SCHEDULES TABLE - Admin can do everything
CREATE POLICY "Admin full access to daily schedules" ON daily_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- INVITATIONS TABLE - Admin can do everything + public read for signup
CREATE POLICY "Public read invitations for signup" ON invitations
  FOR SELECT USING (true);

CREATE POLICY "Admin full access to invitations" ON invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Test the setup
SELECT 'RLS enabled with admin-only access' as status;
SELECT 'Testing admin access...' as test;

-- This should work if you're logged in as admin
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_tasks FROM tasks;
SELECT COUNT(*) as total_assignments FROM task_assignments;
