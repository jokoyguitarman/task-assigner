-- Fix RLS policies to allow outlet users to view tasks and update assignments
-- This will allow outlet users to see task titles and mark tasks as complete

-- Check current RLS policies on tasks table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'tasks' 
AND schemaname = 'public';

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Outlet users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Outlet users can view outlet assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Outlet users can update outlet assignments" ON public.task_assignments;

-- Add a policy for outlet users to view tasks
CREATE POLICY "Outlet users can view tasks" ON public.tasks
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role = 'outlet'
  )
);

-- Check current RLS policies on task_assignments table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'task_assignments' 
AND schemaname = 'public';

-- Add a policy for outlet users to view outlet assignments
CREATE POLICY "Outlet users can view outlet assignments" ON public.task_assignments
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.users u
    JOIN public.outlets o ON o.user_id = u.id
    WHERE u.id = auth.uid()
    AND u.role = 'outlet'
    AND o.id = task_assignments.outlet_id
  )
);

-- Add a policy for outlet users to update outlet assignments (for completion)
CREATE POLICY "Outlet users can update outlet assignments" ON public.task_assignments
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.users u
    JOIN public.outlets o ON o.user_id = u.id
    WHERE u.id = auth.uid()
    AND u.role = 'outlet'
    AND o.id = task_assignments.outlet_id
  )
);

-- Verify the new policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('tasks', 'task_assignments')
AND schemaname = 'public'
ORDER BY tablename, policyname;

SELECT 'Outlet task permissions fixed successfully!' as result;
