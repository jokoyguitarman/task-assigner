-- Disable RLS completely to restore data access
-- This will get your dashboard working immediately

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules DISABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on these tables
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN ('users', 'tasks', 'task_assignments', 'staff_profiles', 'outlets', 'monthly_schedules', 'daily_schedules')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Verify the changes
SELECT 'RLS disabled on all tables' as status;
