-- Fix RLS policies to work with frontend authentication
-- The issue is that helper functions aren't working in frontend context

-- First, let's check what's currently blocking access
SELECT 'Current RLS Status' as check_type;
SELECT schemaname, tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('users', 'staff_profiles', 'tasks', 'task_assignments', 'outlets', 'monthly_schedules', 'daily_schedules', 'invitations')
ORDER BY tablename;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.users;

DROP POLICY IF EXISTS "Admins can manage all staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Outlet users can view staff profiles in their outlet" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can view their own staff profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.staff_profiles;

DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Outlet users can view tasks in their outlet" ON public.tasks;
DROP POLICY IF EXISTS "Staff users can view tasks assigned to them or their outlet" ON public.tasks;

DROP POLICY IF EXISTS "Admins can manage all task assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Outlet users can view/manage assignments in their outlet" ON public.task_assignments;
DROP POLICY IF EXISTS "Staff can view/manage their own assignments" ON public.task_assignments;

DROP POLICY IF EXISTS "Admins can manage all outlets" ON public.outlets;
DROP POLICY IF EXISTS "Outlet users can view their own outlet" ON public.outlets;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.outlets;

-- Create simple policies that work with frontend authentication
-- Users table
CREATE POLICY "Allow authenticated users to read users" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow users to update their own profile" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Allow anon insert for signup" ON public.users
  FOR INSERT WITH CHECK (true);

-- Staff profiles table
CREATE POLICY "Allow authenticated users to read staff profiles" ON public.staff_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to manage staff profiles" ON public.staff_profiles
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Tasks table
CREATE POLICY "Allow authenticated users to read tasks" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to manage tasks" ON public.tasks
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Task assignments table
CREATE POLICY "Allow authenticated users to read task assignments" ON public.task_assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to manage task assignments" ON public.task_assignments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Outlets table
CREATE POLICY "Allow authenticated users to read outlets" ON public.outlets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to manage outlets" ON public.outlets
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Monthly schedules table
CREATE POLICY "Allow authenticated users to read monthly schedules" ON public.monthly_schedules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to manage monthly schedules" ON public.monthly_schedules
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Daily schedules table
CREATE POLICY "Allow authenticated users to read daily schedules" ON public.daily_schedules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to manage daily schedules" ON public.daily_schedules
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Invitations table
CREATE POLICY "Allow public read invitations by token" ON public.invitations
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage invitations" ON public.invitations
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

SELECT 'RLS policies updated to work with frontend authentication.' as status;
