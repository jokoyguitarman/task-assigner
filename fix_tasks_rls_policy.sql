-- Fix RLS policies to allow outlet users to read tasks
-- This will allow outlet users to see task titles instead of "Unknown"

-- Check current RLS policies on tasks table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'tasks' 
AND schemaname = 'public';

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

-- Also add a policy for staff users to view tasks
CREATE POLICY "Staff users can view tasks" ON public.tasks
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.users u
    WHERE u.id = auth.uid()
    AND (u.role = 'staff' OR u.role = 'outlet')
  )
);

-- Verify the new policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'tasks' 
AND schemaname = 'public'
ORDER BY policyname;





