-- Create missing tables for staff management functionality (safe version)
-- This version checks for existing tables and policies

-- 1. Create staff_positions table
CREATE TABLE IF NOT EXISTS public.staff_positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_custom BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create outlets table
CREATE TABLE IF NOT EXISTS public.outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    manager_id UUID REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create staff_profiles table
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.staff_positions(id),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    hire_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create monthly_schedules table
CREATE TABLE IF NOT EXISTS public.monthly_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, month, year)
);

-- 5. Create daily_schedules table
CREATE TABLE IF NOT EXISTS public.daily_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monthly_schedule_id UUID NOT NULL REFERENCES public.monthly_schedules(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    outlet_id UUID REFERENCES public.outlets(id),
    time_in TIME,
    time_out TIME,
    is_day_off BOOLEAN DEFAULT false,
    day_off_type VARCHAR(20) CHECK (day_off_type IN ('vacation', 'sick', 'personal', 'other')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create task_completion_proofs table (check if task_assignments exists first)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_assignments') THEN
        CREATE TABLE IF NOT EXISTS public.task_completion_proofs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            assignment_id UUID NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE,
            file_url TEXT NOT NULL,
            file_type VARCHAR(10) CHECK (file_type IN ('image', 'video')),
            file_size BIGINT,
            created_by UUID REFERENCES public.users(id),
            uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Insert default staff positions (only if table is empty)
INSERT INTO public.staff_positions (name, description, is_custom) 
SELECT * FROM (VALUES
    ('Manager', 'Oversees operations', false),
    ('Supervisor', 'Supervises staff', false),
    ('Cashier', 'Handles transactions', false),
    ('Cook/Chef', 'Prepares food', false),
    ('Server/Waiter', 'Serves customers', false),
    ('Cleaner/Janitor', 'Maintains cleanliness', false),
    ('Security', 'Ensures safety', false)
) AS v(name, description, is_custom)
WHERE NOT EXISTS (SELECT 1 FROM public.staff_positions LIMIT 1);

-- Insert default outlets (only if table is empty)
INSERT INTO public.outlets (name, address, phone, is_active) 
SELECT * FROM (VALUES
    ('Main Branch', '123 Main St', '+1234567890', true),
    ('Downtown Branch', '456 Downtown Ave', '+1234567891', true)
) AS v(name, address, phone, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.outlets LIMIT 1);

-- Enable RLS on all new tables
ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;

-- Only enable RLS on task_completion_proofs if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_completion_proofs') THEN
        ALTER TABLE public.task_completion_proofs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create RLS policies (drop existing ones first to avoid conflicts)

-- Staff positions policies
DROP POLICY IF EXISTS "All users can view staff positions" ON public.staff_positions;
DROP POLICY IF EXISTS "Admin can manage staff positions" ON public.staff_positions;

CREATE POLICY "All users can view staff positions" ON public.staff_positions
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage staff positions" ON public.staff_positions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR current_setting('role') = 'service_role'
    );

-- Outlets policies
DROP POLICY IF EXISTS "All users can view outlets" ON public.outlets;
DROP POLICY IF EXISTS "Admin can manage outlets" ON public.outlets;

CREATE POLICY "All users can view outlets" ON public.outlets
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage outlets" ON public.outlets
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR current_setting('role') = 'service_role'
    );

-- Staff profiles policies
DROP POLICY IF EXISTS "Admin can manage staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff_profiles;

CREATE POLICY "Admin can manage staff profiles" ON public.staff_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR current_setting('role') = 'service_role'
    );

CREATE POLICY "Staff can view own profile" ON public.staff_profiles
    FOR SELECT USING (user_id = auth.uid());

-- Monthly schedules policies
DROP POLICY IF EXISTS "Admin can manage monthly schedules" ON public.monthly_schedules;
DROP POLICY IF EXISTS "Staff can view own schedules" ON public.monthly_schedules;

CREATE POLICY "Admin can manage monthly schedules" ON public.monthly_schedules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR current_setting('role') = 'service_role'
    );

CREATE POLICY "Staff can view own schedules" ON public.monthly_schedules
    FOR SELECT USING (
        staff_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid())
    );

-- Daily schedules policies
DROP POLICY IF EXISTS "Admin can manage daily schedules" ON public.daily_schedules;
DROP POLICY IF EXISTS "Staff can view own daily schedules" ON public.daily_schedules;

CREATE POLICY "Admin can manage daily schedules" ON public.daily_schedules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR current_setting('role') = 'service_role'
    );

CREATE POLICY "Staff can view own daily schedules" ON public.daily_schedules
    FOR SELECT USING (
        monthly_schedule_id IN (
            SELECT id FROM public.monthly_schedules ms
            WHERE ms.staff_id IN (
                SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()
            )
        )
    );

-- Task completion proofs policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_completion_proofs') THEN
        DROP POLICY IF EXISTS "Admin can manage completion proofs" ON public.task_completion_proofs;
        DROP POLICY IF EXISTS "Staff can manage own completion proofs" ON public.task_completion_proofs;

        CREATE POLICY "Admin can manage completion proofs" ON public.task_completion_proofs
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
                OR current_setting('role') = 'service_role'
            );

        CREATE POLICY "Staff can manage own completion proofs" ON public.task_completion_proofs
            FOR ALL USING (
                assignment_id IN (
                    SELECT id FROM public.task_assignments ta
                    WHERE ta.staff_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Show what was created
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        ) THEN 'Created/Exists'
        ELSE 'Failed'
    END as status
FROM (VALUES 
    ('users'),
    ('tasks'),
    ('task_assignments'),
    ('staff_positions'),
    ('outlets'), 
    ('staff_profiles'),
    ('monthly_schedules'),
    ('daily_schedules'),
    ('task_completion_proofs')
) AS tables(table_name);

SELECT 'Staff management tables setup completed successfully!' as result;
