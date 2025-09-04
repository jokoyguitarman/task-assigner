-- Re-enable RLS with proper, working policies
-- Since we know the issue isn't RLS, we can safely re-enable it

-- Re-enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies
CREATE POLICY "Allow authenticated users to read users" ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read tasks" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read outlets" ON public.outlets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read task_assignments" ON public.task_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update task_assignments" ON public.task_assignments
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read staff_profiles" ON public.staff_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read staff_positions" ON public.staff_positions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read monthly_schedules" ON public.monthly_schedules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read daily_schedules" ON public.daily_schedules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read invitations" ON public.invitations
  FOR SELECT
  TO authenticated
  USING (true);
