-- Comprehensive RLS policies for Task Assigner app
-- This will set up all necessary policies to make the app work securely

-- ===============================================
-- 1. USERS TABLE POLICIES
-- ===============================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;
DROP POLICY IF EXISTS "Admin can view all users" ON public.users;

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Policy 2: Admins can view all users (needed for admin dashboard)
CREATE POLICY "Admin can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 3: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Policy 4: Allow insert for new user creation (signup/trigger)
CREATE POLICY "Enable insert for authenticated users" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy 5: Service role can do anything (for triggers and admin operations)
CREATE POLICY "Service role can do anything" ON public.users
    FOR ALL USING (current_setting('role') = 'service_role');

-- ===============================================
-- 2. TASKS TABLE POLICIES
-- ===============================================

-- Enable RLS on tasks table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Staff can view assigned tasks" ON public.tasks;

-- Policy 1: Admins can manage all tasks
CREATE POLICY "Admin can manage all tasks" ON public.tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Staff can view tasks (read-only for staff)
CREATE POLICY "Staff can view tasks" ON public.tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'staff'
        )
    );

-- ===============================================
-- 3. TASK ASSIGNMENTS TABLE POLICIES
-- ===============================================

-- Enable RLS on task_assignments table
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage all assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Staff can view own assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Staff can update own assignments" ON public.task_assignments;

-- Policy 1: Admins can manage all assignments
CREATE POLICY "Admin can manage all assignments" ON public.task_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Staff can view their own assignments
CREATE POLICY "Staff can view own assignments" ON public.task_assignments
    FOR SELECT USING (staff_id = auth.uid());

-- Policy 3: Staff can update their own assignments (for completion)
CREATE POLICY "Staff can update own assignments" ON public.task_assignments
    FOR UPDATE USING (staff_id = auth.uid());

-- ===============================================
-- 4. STAFF POSITIONS TABLE POLICIES
-- ===============================================

-- Enable RLS on staff_positions table
ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage staff positions" ON public.staff_positions;
DROP POLICY IF EXISTS "All users can view staff positions" ON public.staff_positions;

-- Policy 1: Admins can manage staff positions
CREATE POLICY "Admin can manage staff positions" ON public.staff_positions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: All authenticated users can view staff positions
CREATE POLICY "All users can view staff positions" ON public.staff_positions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- ===============================================
-- 5. OUTLETS TABLE POLICIES
-- ===============================================

-- Enable RLS on outlets table
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage outlets" ON public.outlets;
DROP POLICY IF EXISTS "All users can view outlets" ON public.outlets;

-- Policy 1: Admins can manage outlets
CREATE POLICY "Admin can manage outlets" ON public.outlets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: All authenticated users can view outlets
CREATE POLICY "All users can view outlets" ON public.outlets
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- ===============================================
-- 6. STAFF PROFILES TABLE POLICIES
-- ===============================================

-- Enable RLS on staff_profiles table
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff_profiles;

-- Policy 1: Admins can manage all staff profiles
CREATE POLICY "Admin can manage staff profiles" ON public.staff_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Staff can view their own profile
CREATE POLICY "Staff can view own profile" ON public.staff_profiles
    FOR SELECT USING (user_id = auth.uid());

-- ===============================================
-- 7. MONTHLY SCHEDULES TABLE POLICIES
-- ===============================================

-- Enable RLS on monthly_schedules table
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage monthly schedules" ON public.monthly_schedules;
DROP POLICY IF EXISTS "Staff can view own schedules" ON public.monthly_schedules;

-- Policy 1: Admins can manage all monthly schedules
CREATE POLICY "Admin can manage monthly schedules" ON public.monthly_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Staff can view their own schedules
CREATE POLICY "Staff can view own schedules" ON public.monthly_schedules
    FOR SELECT USING (staff_id = auth.uid());

-- ===============================================
-- 8. DAILY SCHEDULES TABLE POLICIES
-- ===============================================

-- Enable RLS on daily_schedules table
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage daily schedules" ON public.daily_schedules;
DROP POLICY IF EXISTS "Staff can view own daily schedules" ON public.daily_schedules;

-- Policy 1: Admins can manage all daily schedules
CREATE POLICY "Admin can manage daily schedules" ON public.daily_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Staff can view their own daily schedules
CREATE POLICY "Staff can view own daily schedules" ON public.daily_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.monthly_schedules ms
            WHERE ms.id = daily_schedules.monthly_schedule_id 
            AND ms.staff_id = auth.uid()
        )
    );

-- ===============================================
-- 9. TASK COMPLETION PROOFS TABLE POLICIES
-- ===============================================

-- Enable RLS on task_completion_proofs table
ALTER TABLE public.task_completion_proofs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage completion proofs" ON public.task_completion_proofs;
DROP POLICY IF EXISTS "Staff can manage own completion proofs" ON public.task_completion_proofs;

-- Policy 1: Admins can manage all completion proofs
CREATE POLICY "Admin can manage completion proofs" ON public.task_completion_proofs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Staff can manage their own completion proofs
CREATE POLICY "Staff can manage own completion proofs" ON public.task_completion_proofs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.task_assignments ta
            WHERE ta.id = task_completion_proofs.assignment_id 
            AND ta.staff_id = auth.uid()
        )
    );

-- ===============================================
-- 10. VERIFICATION AND SUMMARY
-- ===============================================

-- Show all created policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN cmd = 'ALL' THEN 'Create, Read, Update, Delete'
        WHEN cmd = 'SELECT' THEN 'Read'
        WHEN cmd = 'INSERT' THEN 'Create'
        WHEN cmd = 'UPDATE' THEN 'Update'
        WHEN cmd = 'DELETE' THEN 'Delete'
    END as permissions
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Show RLS status for all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'tasks', 'task_assignments', 'staff_positions', 
    'outlets', 'staff_profiles', 'monthly_schedules', 
    'daily_schedules', 'task_completion_proofs'
)
ORDER BY tablename;

SELECT 'RLS policies created successfully! Your app should now work properly.' as status;
