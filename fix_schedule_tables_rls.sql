-- Fix schedule tables and RLS policies
-- This script ensures monthly_schedules and daily_schedules tables exist with proper policies

-- Create monthly_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.monthly_schedules (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, month, year)
);

-- Create daily_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.daily_schedules (
    id SERIAL PRIMARY KEY,
    monthly_schedule_id INTEGER NOT NULL REFERENCES public.monthly_schedules(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    outlet_id INTEGER REFERENCES public.outlets(id),
    time_in TIME,
    time_out TIME,
    is_day_off BOOLEAN DEFAULT FALSE,
    day_off_type TEXT CHECK (day_off_type IN ('vacation', 'sick', 'personal', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(monthly_schedule_id, schedule_date)
);

-- Enable RLS on both tables
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Authenticated users can read monthly schedules" ON public.monthly_schedules;
DROP POLICY IF EXISTS "Admins can create monthly schedules" ON public.monthly_schedules;
DROP POLICY IF EXISTS "Admins can update monthly schedules" ON public.monthly_schedules;
DROP POLICY IF EXISTS "Admins can delete monthly schedules" ON public.monthly_schedules;
DROP POLICY IF EXISTS "Service role full access monthly schedules" ON public.monthly_schedules;

DROP POLICY IF EXISTS "Authenticated users can read daily schedules" ON public.daily_schedules;
DROP POLICY IF EXISTS "Admins can create daily schedules" ON public.daily_schedules;
DROP POLICY IF EXISTS "Admins can update daily schedules" ON public.daily_schedules;
DROP POLICY IF EXISTS "Admins can delete daily schedules" ON public.daily_schedules;
DROP POLICY IF EXISTS "Service role full access daily schedules" ON public.daily_schedules;

-- Create RLS policies for monthly_schedules
-- 1. Allow authenticated users to read all monthly schedules
CREATE POLICY "Authenticated users can read monthly schedules" ON public.monthly_schedules
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Allow admins to create monthly schedules
CREATE POLICY "Admins can create monthly schedules" ON public.monthly_schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 3. Allow admins to update monthly schedules
CREATE POLICY "Admins can update monthly schedules" ON public.monthly_schedules
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 4. Allow admins to delete monthly schedules
CREATE POLICY "Admins can delete monthly schedules" ON public.monthly_schedules
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 5. Service role has full access
CREATE POLICY "Service role full access monthly schedules" ON public.monthly_schedules
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create RLS policies for daily_schedules
-- 1. Allow authenticated users to read all daily schedules
CREATE POLICY "Authenticated users can read daily schedules" ON public.daily_schedules
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Allow admins to create daily schedules
CREATE POLICY "Admins can create daily schedules" ON public.daily_schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 3. Allow admins to update daily schedules
CREATE POLICY "Admins can update daily schedules" ON public.daily_schedules
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 4. Allow admins to delete daily schedules
CREATE POLICY "Admins can delete daily schedules" ON public.daily_schedules
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 5. Service role has full access
CREATE POLICY "Service role full access daily schedules" ON public.daily_schedules
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_staff ON public.monthly_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_date ON public.monthly_schedules(year, month);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_monthly ON public.daily_schedules(monthly_schedule_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_date ON public.daily_schedules(schedule_date);

-- Verify the tables exist
SELECT 'monthly_schedules table ready' as status;
SELECT 'daily_schedules table ready' as status;
