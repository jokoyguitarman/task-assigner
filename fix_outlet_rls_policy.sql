-- Fix RLS policies to allow outlet users to read assignments for their outlet
-- This will allow outlet users to see tasks assigned to their location

-- Add a new policy for outlet users to view assignments for their outlet
CREATE POLICY "Outlet users can view outlet assignments" ON public.task_assignments
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.outlets o
    JOIN public.users u ON o.user_id = u.id
    WHERE o.id = task_assignments.outlet_id 
    AND u.id = auth.uid()
    AND u.role = 'outlet'
  )
);

-- Also add a policy for outlet users to update assignments for their outlet
CREATE POLICY "Outlet users can update outlet assignments" ON public.task_assignments
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.outlets o
    JOIN public.users u ON o.user_id = u.id
    WHERE o.id = task_assignments.outlet_id 
    AND u.id = auth.uid()
    AND u.role = 'outlet'
  )
);

-- Verify the new policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'task_assignments' 
AND schemaname = 'public'
ORDER BY policyname;
