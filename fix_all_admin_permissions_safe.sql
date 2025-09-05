-- Safe fix for all admin RLS permissions
-- This script handles existing policies gracefully

-- Check current user and role
SELECT 
    auth.uid() as current_user_id,
    u.email,
    u.role
FROM users u
WHERE u.id = auth.uid();

-- =============================================
-- FIX INVITATIONS TABLE
-- =============================================

-- Drop existing policies safely
DROP POLICY IF EXISTS "Admin can manage all invitations" ON invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON invitations;
DROP POLICY IF EXISTS "Users can update their own invitations" ON invitations;
DROP POLICY IF EXISTS "Users can view their own invitations" ON invitations;

-- Create invitations policies
CREATE POLICY "Admin can manage all invitations" ON invitations
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

CREATE POLICY "Users can view invitations sent to them" ON invitations
    FOR SELECT
    TO authenticated
    USING (
        email = (
            SELECT email FROM users 
            WHERE users.id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own invitations" ON invitations
    FOR UPDATE
    TO authenticated
    USING (
        email = (
            SELECT email FROM users 
            WHERE users.id = auth.uid()
        )
    )
    WITH CHECK (
        email = (
            SELECT email FROM users 
            WHERE users.id = auth.uid()
        )
    );

-- =============================================
-- FIX OUTLETS TABLE
-- =============================================

-- Drop existing policies safely
DROP POLICY IF EXISTS "Admin can manage all outlets" ON outlets;
DROP POLICY IF EXISTS "Users can view outlets" ON outlets;
DROP POLICY IF EXISTS "Outlet users can view their outlet" ON outlets;
DROP POLICY IF EXISTS "Admin can manage outlets" ON outlets;
DROP POLICY IF EXISTS "Users can read outlets" ON outlets;

-- Create outlets policies
CREATE POLICY "Admin can manage all outlets" ON outlets
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

CREATE POLICY "Users can view outlets" ON outlets
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Outlet users can view their outlet" ON outlets
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT outlet_id FROM staff_profiles 
            WHERE user_id = auth.uid()
        )
    );

-- =============================================
-- FIX TASKS TABLE
-- =============================================

-- Drop existing policies safely
DROP POLICY IF EXISTS "Admin can manage all tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Admin can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Users can read tasks" ON tasks;

-- Create tasks policies
CREATE POLICY "Admin can manage all tasks" ON tasks
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

CREATE POLICY "Users can view tasks" ON tasks
    FOR SELECT
    TO authenticated
    USING (true);

-- =============================================
-- FIX STAFF_PROFILES TABLE
-- =============================================

-- Drop existing policies safely
DROP POLICY IF EXISTS "Admin can manage all staff profiles" ON staff_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON staff_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON staff_profiles;
DROP POLICY IF EXISTS "Admin can manage staff profiles" ON staff_profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON staff_profiles;

-- Create staff_profiles policies
CREATE POLICY "Admin can manage all staff profiles" ON staff_profiles
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

CREATE POLICY "Users can view their own profile" ON staff_profiles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON staff_profiles
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VERIFY POLICIES WERE CREATED
-- =============================================

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd
FROM pg_policies 
WHERE tablename IN ('invitations', 'outlets', 'tasks', 'staff_profiles')
ORDER BY tablename, policyname;
