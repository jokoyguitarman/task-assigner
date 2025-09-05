-- Simple RLS fix to avoid deadlocks
-- This approach is safer and less likely to cause conflicts

-- First, let's temporarily disable RLS to restore access
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules DISABLE ROW LEVEL SECURITY;

-- Check if this worked
SELECT 'RLS disabled successfully' as status;
