-- Fix RLS policies to allow admin users to read all data
-- This will restore access to the database for admin users

-- First, let's check what policies currently exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules')
ORDER BY tablename, policyname;

-- Drop existing restrictive policies and create new ones that allow admin access
-- Users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Allow public read invitations by token" ON users;
DROP POLICY IF EXISTS "Allow anon users to insert during signup" ON users;

CREATE POLICY "Admin can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert users" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can update users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Tasks table
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Admin can manage tasks" ON tasks;

CREATE POLICY "Admin can view all tasks" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert tasks" ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can update tasks" ON tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Task assignments table
DROP POLICY IF EXISTS "Users can view their assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admin can manage assignments" ON task_assignments;

CREATE POLICY "Admin can view all assignments" ON task_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert assignments" ON task_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can update assignments" ON task_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Staff profiles table
DROP POLICY IF EXISTS "Users can view staff profiles" ON staff_profiles;
DROP POLICY IF EXISTS "Admin can manage staff profiles" ON staff_profiles;

CREATE POLICY "Admin can view all staff profiles" ON staff_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert staff profiles" ON staff_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can update staff profiles" ON staff_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Outlets table
DROP POLICY IF EXISTS "Users can view outlets" ON outlets;
DROP POLICY IF EXISTS "Admin can manage outlets" ON outlets;

CREATE POLICY "Admin can view all outlets" ON outlets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert outlets" ON outlets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can update outlets" ON outlets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Monthly schedules table
DROP POLICY IF EXISTS "Users can view monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Admin can manage monthly schedules" ON monthly_schedules;

CREATE POLICY "Admin can view all monthly schedules" ON monthly_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert monthly schedules" ON monthly_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can update monthly schedules" ON monthly_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Daily schedules table
DROP POLICY IF EXISTS "Users can view daily schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Admin can manage daily schedules" ON daily_schedules;

CREATE POLICY "Admin can view all daily schedules" ON daily_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert daily schedules" ON daily_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can update daily schedules" ON daily_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Check the results
SELECT 'RLS policies updated successfully' as status;
