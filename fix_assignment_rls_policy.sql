-- Fix RLS policy for task_assignments to allow assignment creation
-- The current policy is too restrictive and not recognizing admin users properly

-- First, let's see what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'task_assignments' 
AND schemaname = 'public'
ORDER BY policyname;

-- Drop the existing admin policy that's not working
DROP POLICY IF EXISTS "Admin can manage all assignments" ON public.task_assignments;

-- Create a new, more permissive admin policy
CREATE POLICY "Admin can manage all assignments" ON public.task_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (role = 'admin' OR role = 'outlet')
        )
        OR current_setting('role') = 'service_role'
    );

-- Also add a policy for users within the same organization
CREATE POLICY "Users can manage assignments in their organization" ON public.task_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.organization_id = (
                SELECT organization_id 
                FROM public.tasks t 
                WHERE t.id = task_assignments.task_id
            )
        )
    );

-- Verify the new policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'task_assignments' 
AND schemaname = 'public'
ORDER BY policyname;
