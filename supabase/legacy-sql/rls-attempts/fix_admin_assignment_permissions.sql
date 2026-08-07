-- Fix RLS policies to allow admin users to create and manage task assignments
-- This script ensures admin users have full access to task_assignments table

-- First, let's check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'task_assignments';

-- Drop existing policies that might be blocking admin access
DROP POLICY IF EXISTS "Admin users can manage all assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admin users can create assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admin users can update assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admin users can delete assignments" ON task_assignments;

-- Create comprehensive admin policies for task_assignments
CREATE POLICY "Admin users can manage all assignments" ON task_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Ensure RLS is enabled on task_assignments
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Also ensure admin users can manage tasks table
DROP POLICY IF EXISTS "Admin users can manage all tasks" ON tasks;

CREATE POLICY "Admin users can manage all tasks" ON tasks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Ensure RLS is enabled on tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('task_assignments', 'tasks')
ORDER BY tablename, policyname;
