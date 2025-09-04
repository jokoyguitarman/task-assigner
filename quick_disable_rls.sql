-- QUICK FIX: Temporarily disable RLS to test if that's the issue
-- This will help us determine if RLS is still causing problems

-- Disable RLS on all tables temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;

-- This will make all data accessible to test if RLS was the problem
-- If this fixes the issue, we know RLS was the problem
-- If this doesn't fix it, the issue is elsewhere in the code