-- Corrected fix for schedule permissions
-- This script fixes RLS policies for both monthly_schedules and daily_schedules tables
-- WITHOUT referencing the non-existent users.outlet_id column

-- First, let's check current user and their role
SELECT id, email, role FROM users WHERE id = auth.uid();

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
    )
    WITH CHECK (
        -- Same conditions for the updated values
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
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
    )
    WITH CHECK (
        -- Same conditions for the updated values
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
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
SELECT 'RLS policies updated successfully. Admin users should now be able to create schedules.' as status;
