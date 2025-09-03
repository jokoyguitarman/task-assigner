-- Quick fix: Temporarily disable RLS to test the app
-- You can re-enable it later with proper policies

-- Disable RLS on all main tables
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_proofs DISABLE ROW LEVEL SECURITY;

-- Check status
SELECT 
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

SELECT 'RLS temporarily disabled - your app should work now!' as status;
