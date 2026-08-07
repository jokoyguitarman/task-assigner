-- Fix RLS policies for daily_schedules table
-- Allow admin users to create, read, update, and delete daily schedules

-- First, let's check the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'daily_schedules';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "daily_schedules_select_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_insert_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_update_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_delete_policy" ON daily_schedules;

-- Create new policies that allow admin users full access
CREATE POLICY "daily_schedules_select_policy" ON daily_schedules
    FOR SELECT
    USING (
        -- Allow admin users to see all daily schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to see schedules for their outlet
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND users.outlet_id = daily_schedules.outlet_id
        )
        OR
        -- Allow staff to see schedules they're assigned to
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'staff'
            AND EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.user_id = auth.uid()
                AND sp.id = daily_schedules.staff_id
            )
        )
    );

CREATE POLICY "daily_schedules_insert_policy" ON daily_schedules
    FOR INSERT
    WITH CHECK (
        -- Allow admin users to create daily schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to create schedules for their outlet
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND users.outlet_id = daily_schedules.outlet_id
        )
    );

CREATE POLICY "daily_schedules_update_policy" ON daily_schedules
    FOR UPDATE
    USING (
        -- Allow admin users to update all daily schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to update schedules for their outlet
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND users.outlet_id = daily_schedules.outlet_id
        )
    )
    WITH CHECK (
        -- Same conditions for the updated values
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND users.outlet_id = daily_schedules.outlet_id
        )
    );

CREATE POLICY "daily_schedules_delete_policy" ON daily_schedules
    FOR DELETE
    USING (
        -- Allow admin users to delete all daily schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to delete schedules for their outlet
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND users.outlet_id = daily_schedules.outlet_id
        )
    );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'daily_schedules'
ORDER BY policyname;
