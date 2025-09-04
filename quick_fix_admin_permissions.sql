-- Quick fix for admin assignment permissions
-- This allows admin users to create and manage task assignments

-- Drop existing policies that might be blocking admin access
DROP POLICY IF EXISTS "Admin users can manage all assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admin users can manage all tasks" ON tasks;

-- Create simple admin policies
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

-- Ensure RLS is enabled
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
