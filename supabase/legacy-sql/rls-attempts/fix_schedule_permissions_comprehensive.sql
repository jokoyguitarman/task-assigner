-- Comprehensive fix for schedule permissions
-- This script fixes RLS policies for both monthly_schedules and daily_schedules tables

-- First, let's check current user and their role
SELECT id, email, role, outlet_id FROM users WHERE id = auth.uid();

-- Check if RLS is enabled on the tables
SELECT schemaname, tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('monthly_schedules', 'daily_schedules');

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('monthly_schedules', 'daily_schedules')
ORDER BY tablename, policyname;

-- ==============================================
-- FIX MONTHLY SCHEDULES RLS POLICIES
-- ==============================================

-- Drop existing policies
DROP POLICY IF EXISTS "monthly_schedules_select_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_insert_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_update_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_delete_policy" ON monthly_schedules;

-- Create new policies for monthly_schedules
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
                JOIN users u ON u.id = sp.user_id
                WHERE sp.id = monthly_schedules.staff_id
                AND u.outlet_id = (SELECT outlet_id FROM users WHERE id = auth.uid())
            )
        )
        OR
        -- Allow staff to see their own schedules
        EXISTS (
            SELECT 1 FROM staff_profiles sp
            WHERE sp.user_id = auth.uid()
            AND sp.id = monthly_schedules.staff_id
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
                JOIN users u ON u.id = sp.user_id
                WHERE sp.id = monthly_schedules.staff_id
                AND u.outlet_id = (SELECT outlet_id FROM users WHERE id = auth.uid())
            )
        )
    );

CREATE POLICY "monthly_schedules_update_policy" ON monthly_schedules
    FOR UPDATE
    USING (
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
                JOIN users u ON u.id = sp.user_id
                WHERE sp.id = monthly_schedules.staff_id
                AND u.outlet_id = (SELECT outlet_id FROM users WHERE id = auth.uid())
            )
        )
    )
    WITH CHECK (
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
                JOIN users u ON u.id = sp.user_id
                WHERE sp.id = monthly_schedules.staff_id
                AND u.outlet_id = (SELECT outlet_id FROM users WHERE id = auth.uid())
            )
        )
    );

CREATE POLICY "monthly_schedules_delete_policy" ON monthly_schedules
    FOR DELETE
    USING (
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
                JOIN users u ON u.id = sp.user_id
                WHERE sp.id = monthly_schedules.staff_id
                AND u.outlet_id = (SELECT outlet_id FROM users WHERE id = auth.uid())
            )
        )
    );

-- ==============================================
-- FIX DAILY SCHEDULES RLS POLICIES
-- ==============================================

-- Drop existing policies
DROP POLICY IF EXISTS "daily_schedules_select_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_insert_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_update_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_delete_policy" ON daily_schedules;

-- Create new policies for daily_schedules
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
            SELECT 1 FROM staff_profiles sp
            WHERE sp.user_id = auth.uid()
            AND sp.id = daily_schedules.staff_id
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
    )
    WITH CHECK (
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

-- ==============================================
-- VERIFY THE FIXES
-- ==============================================

-- Check that policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('monthly_schedules', 'daily_schedules')
ORDER BY tablename, policyname;

-- Test if admin can now insert into daily_schedules
-- (This will only work if run by an admin user)
SELECT 'RLS policies updated successfully. Admin users should now be able to create schedules.' as status;
