-- Check the actual structure of schedule tables and fix RLS policies
-- This script will first examine the table structure, then create appropriate policies

-- ==============================================
-- CHECK TABLE STRUCTURES
-- ==============================================

-- Check daily_schedules table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'daily_schedules' 
ORDER BY ordinal_position;

-- Check monthly_schedules table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'monthly_schedules' 
ORDER BY ordinal_position;

-- Check if there are any foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('daily_schedules', 'monthly_schedules');

-- ==============================================
-- DROP EXISTING POLICIES
-- ==============================================

-- Drop existing policies for monthly_schedules
DROP POLICY IF EXISTS "monthly_schedules_select_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_insert_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_update_policy" ON monthly_schedules;
DROP POLICY IF EXISTS "monthly_schedules_delete_policy" ON monthly_schedules;

-- Drop existing policies for daily_schedules
DROP POLICY IF EXISTS "daily_schedules_select_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_insert_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_update_policy" ON daily_schedules;
DROP POLICY IF EXISTS "daily_schedules_delete_policy" ON daily_schedules;

-- ==============================================
-- CREATE SIMPLE ADMIN-ONLY POLICIES
-- ==============================================

-- Create policies for monthly_schedules (admin only for now)
CREATE POLICY "monthly_schedules_select_policy" ON monthly_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "monthly_schedules_insert_policy" ON monthly_schedules
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
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
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
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
    );

-- Create policies for daily_schedules (admin only for now)
CREATE POLICY "daily_schedules_select_policy" ON daily_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "daily_schedules_insert_policy" ON daily_schedules
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
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
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
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
    );

-- ==============================================
-- VERIFY THE FIXES
-- ==============================================

-- Check that policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('monthly_schedules', 'daily_schedules')
ORDER BY tablename, policyname;

-- Test current user
SELECT id, email, role FROM users WHERE id = auth.uid();

SELECT 'RLS policies updated successfully. Admin users should now be able to create schedules.' as status;
