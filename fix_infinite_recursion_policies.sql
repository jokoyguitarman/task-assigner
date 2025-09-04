-- Fix infinite recursion in RLS policies
-- The issue is that policies are referencing each other causing infinite loops

-- First, disable RLS temporarily to fix the policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Outlet users can view users" ON public.users;
DROP POLICY IF EXISTS "Outlet users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Outlet users can view outlet assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Outlet users can update outlet assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Outlet users can view outlets" ON public.outlets;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies

-- Allow all authenticated users to view users (for getting assigner info)
CREATE POLICY "Authenticated users can view users" ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to view tasks
CREATE POLICY "Authenticated users can view tasks" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to view outlets
CREATE POLICY "Authenticated users can view outlets" ON public.outlets
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow outlet users to view task assignments for their outlet
CREATE POLICY "Outlet users can view outlet assignments" ON public.task_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.user_id = auth.uid()
      AND o.id = task_assignments.outlet_id
    )
  );

-- Allow outlet users to update task assignments for their outlet
CREATE POLICY "Outlet users can update outlet assignments" ON public.task_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.user_id = auth.uid()
      AND o.id = task_assignments.outlet_id
    )
  );

-- Allow staff users to view their own assignments
CREATE POLICY "Staff users can view their assignments" ON public.task_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.user_id = auth.uid()
      AND sp.id = task_assignments.staff_id
    )
  );

-- Allow staff users to update their own assignments
CREATE POLICY "Staff users can update their assignments" ON public.task_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.user_id = auth.uid()
      AND sp.id = task_assignments.staff_id
    )
  );

-- Allow admins to do everything
CREATE POLICY "Admins can do everything on users" ON public.users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can do everything on tasks" ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can do everything on task_assignments" ON public.task_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can do everything on outlets" ON public.outlets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );