-- Fix RLS policies for real-time access
-- This script ensures that real-time subscriptions work properly

-- First, let's check current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'task_assignments';

-- Enable RLS if not already enabled
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be blocking real-time
DROP POLICY IF EXISTS "task_assignments_select_policy" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_insert_policy" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_update_policy" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_delete_policy" ON task_assignments;

-- Create new policies that allow real-time access
-- Admin can see all assignments
CREATE POLICY "task_assignments_admin_all" ON task_assignments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Staff can see their own assignments
CREATE POLICY "task_assignments_staff_own" ON task_assignments
    FOR ALL
    TO authenticated
    USING (
        staff_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'staff'
            AND task_assignments.staff_id = auth.uid()
        )
    );

-- Outlet users can see assignments for their outlet
CREATE POLICY "task_assignments_outlet_own" ON task_assignments
    FOR ALL
    TO authenticated
    USING (
        outlet_id IN (
            SELECT id FROM outlets 
            WHERE organization_id = (
                SELECT organization_id FROM users 
                WHERE users.id = auth.uid()
            )
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND task_assignments.outlet_id IN (
                SELECT id FROM outlets 
                WHERE organization_id = users.organization_id
            )
        )
    );

-- Allow real-time subscriptions by ensuring users can at least SELECT
-- This is crucial for real-time to work
CREATE POLICY "task_assignments_realtime_access" ON task_assignments
    FOR SELECT
    TO authenticated
    USING (true); -- Allow all authenticated users to receive real-time events

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'task_assignments'
ORDER BY policyname;
