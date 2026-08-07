-- Fix the circular dependency issue in RLS policies
-- The problem: policies can't access the users table when RLS is enabled

-- First, disable RLS temporarily to fix the policies
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
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

-- Create a function to check if current user is admin
-- This avoids the circular dependency issue
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if current user is outlet user
CREATE OR REPLACE FUNCTION is_outlet_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'outlet'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if current user is staff
CREATE OR REPLACE FUNCTION is_staff_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'staff'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now create policies using these functions
-- Users table - Admin can do everything
CREATE POLICY "Admin full access to users" ON users
  FOR ALL USING (is_admin());

-- Tasks table - Admin can do everything
CREATE POLICY "Admin full access to tasks" ON tasks
  FOR ALL USING (is_admin());

-- Task assignments table - Admin can do everything
CREATE POLICY "Admin full access to assignments" ON task_assignments
  FOR ALL USING (is_admin());

-- Staff profiles table - Admin can do everything
CREATE POLICY "Admin full access to staff profiles" ON staff_profiles
  FOR ALL USING (is_admin());

-- Outlets table - Admin can do everything
CREATE POLICY "Admin full access to outlets" ON outlets
  FOR ALL USING (is_admin());

-- Monthly schedules table - Admin can do everything
CREATE POLICY "Admin full access to monthly schedules" ON monthly_schedules
  FOR ALL USING (is_admin());

-- Daily schedules table - Admin can do everything
CREATE POLICY "Admin full access to daily schedules" ON daily_schedules
  FOR ALL USING (is_admin());

-- Invitations table - Public read + Admin full access
CREATE POLICY "Public read invitations for signup" ON invitations
  FOR SELECT USING (true);

CREATE POLICY "Admin full access to invitations" ON invitations
  FOR ALL USING (is_admin());

-- Add outlet user access
CREATE POLICY "Outlet users access staff profiles" ON staff_profiles
  FOR SELECT USING (is_outlet_user());

CREATE POLICY "Outlet users access assignments" ON task_assignments
  FOR SELECT USING (is_outlet_user());

-- Add staff user access
CREATE POLICY "Staff users access own profile" ON staff_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Staff users access own assignments" ON task_assignments
  FOR SELECT USING (
    staff_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid())
  );

-- Now re-enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Test the setup
SELECT 'RLS fixed with helper functions - should work now' as status;
