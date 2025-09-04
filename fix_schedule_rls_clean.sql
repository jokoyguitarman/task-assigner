-- Clean fix for RLS policies for schedule tables
-- This script will properly handle existing policies

-- First, let's see what policies exist and drop them all
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all existing policies on monthly_schedules
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'monthly_schedules' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.monthly_schedules', pol.policyname);
    END LOOP;
    
    -- Drop all existing policies on daily_schedules
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'daily_schedules' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.daily_schedules', pol.policyname);
    END LOOP;
END $$;

-- Create new simple policies that allow all authenticated users to manage schedules
CREATE POLICY "Allow authenticated users to manage monthly schedules" ON public.monthly_schedules
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage daily schedules" ON public.daily_schedules
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Service role still has full access
CREATE POLICY "Service role full access monthly schedules" ON public.monthly_schedules
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access daily schedules" ON public.daily_schedules
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify the policies were created
SELECT 'RLS policies updated successfully' as status;

