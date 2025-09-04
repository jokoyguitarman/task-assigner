-- Fix RLS policies to allow outlet users to access task assignments for completion
-- This ensures outlet users can view and update task assignments for their outlet

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Outlet users can view outlet assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Outlet users can update outlet assignments" ON public.task_assignments;

-- Allow outlet users to view task assignments for their outlet
CREATE POLICY "Outlet users can view outlet assignments" ON public.task_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.outlets o ON o.user_id = u.id
      WHERE u.id = auth.uid()
      AND u.role = 'outlet'
      AND o.id = task_assignments.outlet_id
    )
  );

-- Allow outlet users to update task assignments for their outlet (for completion)
CREATE POLICY "Outlet users can update outlet assignments" ON public.task_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.outlets o ON o.user_id = u.id
      WHERE u.id = auth.uid()
      AND u.role = 'outlet'
      AND o.id = task_assignments.outlet_id
    )
  );

-- Also ensure outlet users can view tasks
DROP POLICY IF EXISTS "Outlet users can view tasks" ON public.tasks;

CREATE POLICY "Outlet users can view tasks" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'outlet'
    )
  );

-- Ensure outlet users can view outlets
DROP POLICY IF EXISTS "Outlet users can view outlets" ON public.outlets;

CREATE POLICY "Outlet users can view outlets" ON public.outlets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'outlet'
    )
  );

-- Ensure outlet users can view users (for getting assigner info)
DROP POLICY IF EXISTS "Outlet users can view users" ON public.users;

CREATE POLICY "Outlet users can view users" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'outlet'
    )
  );
