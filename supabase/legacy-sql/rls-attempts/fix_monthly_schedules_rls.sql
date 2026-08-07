-- Fix RLS policies for monthly_schedules table
-- Allow admin users to create, read, update, and delete monthly schedules

-- First, let's check the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'monthly_schedules';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "monthly_schedules_select_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_insert_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_update_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_delete_policy" ON monthly_schedules;

-- Create new policies that allow admin users full access
CREATE POLICY "monthly_schedules_select_policy" ON monthly_schedules
    FOR SELECT
    USING (
        -- Allow admin users to see all monthly schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to see schedules for their outlet staff
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.id = monthly_schedules.staff_id
                AND sp.user_id IN (
                    SELECT id FROM users 
                    WHERE outlet_id = users.outlet_id
                )
            )
        )
        OR
        -- Allow staff to see their own schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'staff'
            AND EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.user_id = auth.uid()
                AND sp.id = monthly_schedules.staff_id
            )
        )
    );

CREATE POLICY "monthly_schedules_insert_policy" ON monthly_schedules
    FOR INSERT
    WITH CHECK (
        -- Allow admin users to create monthly schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to create schedules for their outlet staff
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.id = monthly_schedules.staff_id
                AND sp.user_id IN (
                    SELECT id FROM users 
                    WHERE outlet_id = users.outlet_id
                )
            )
        )
    );

CREATE POLICY "monthly_schedules_update_policy" ON monthly_schedules
    FOR UPDATE
    USING (
        -- Allow admin users to update all monthly schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to update schedules for their outlet staff
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.id = monthly_schedules.staff_id
                AND sp.user_id IN (
                    SELECT id FROM users 
                    WHERE outlet_id = users.outlet_id
                )
            )
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
            AND EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.id = monthly_schedules.staff_id
                AND sp.user_id IN (
                    SELECT id FROM users 
                    WHERE outlet_id = users.outlet_id
                )
            )
        )
    );

CREATE POLICY "monthly_schedules_delete_policy" ON monthly_schedules
    FOR DELETE
    USING (
        -- Allow admin users to delete all monthly schedules
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
        OR
        -- Allow outlet users to delete schedules for their outlet staff
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'outlet'
            AND EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.id = monthly_schedules.staff_id
                AND sp.user_id IN (
                    SELECT id FROM users 
                    WHERE outlet_id = users.outlet_id
                )
            )
        )
    );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'monthly_schedules'
ORDER BY policyname;
