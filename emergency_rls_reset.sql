-- EMERGENCY RLS RESET - Complete policy cleanup
-- This will completely reset all RLS policies to fix infinite recursion

-- Step 1: Disable RLS on all tables
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (force drop)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Step 4: Create minimal, safe policies

-- Users table - allow all authenticated users to read
CREATE POLICY "Allow authenticated read users" ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Tasks table - allow all authenticated users to read
CREATE POLICY "Allow authenticated read tasks" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (true);

-- Outlets table - allow all authenticated users to read
CREATE POLICY "Allow authenticated read outlets" ON public.outlets
  FOR SELECT
  TO authenticated
  USING (true);

-- Task assignments - allow all authenticated users to read
CREATE POLICY "Allow authenticated read task_assignments" ON public.task_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- Task assignments - allow all authenticated users to update
CREATE POLICY "Allow authenticated update task_assignments" ON public.task_assignments
  FOR UPDATE
  TO authenticated
  USING (true);

-- Staff profiles - allow all authenticated users to read
CREATE POLICY "Allow authenticated read staff_profiles" ON public.staff_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff positions - allow all authenticated users to read
CREATE POLICY "Allow authenticated read staff_positions" ON public.staff_positions
  FOR SELECT
  TO authenticated
  USING (true);

-- Monthly schedules - allow all authenticated users to read
CREATE POLICY "Allow authenticated read monthly_schedules" ON public.monthly_schedules
  FOR SELECT
  TO authenticated
  USING (true);

-- Daily schedules - allow all authenticated users to read
CREATE POLICY "Allow authenticated read daily_schedules" ON public.daily_schedules
  FOR SELECT
  TO authenticated
  USING (true);

-- Invitations - allow all authenticated users to read
CREATE POLICY "Allow authenticated read invitations" ON public.invitations
  FOR SELECT
  TO authenticated
  USING (true);

-- Step 5: Grant necessary permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Step 6: Verify no policies are causing recursion
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
