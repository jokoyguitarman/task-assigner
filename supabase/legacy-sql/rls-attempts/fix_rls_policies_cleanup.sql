-- Clean up all conflicting RLS policies and create clean organization-based ones

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Admin can manage all outlets" ON public.outlets;
DROP POLICY IF EXISTS "Admin full access to outlets" ON public.outlets;
DROP POLICY IF EXISTS "Outlet users can view outlets" ON public.outlets;
DROP POLICY IF EXISTS "Users can view outlets" ON public.outlets;
DROP POLICY IF EXISTS "Users can view outlets in their organization" ON public.outlets;
DROP POLICY IF EXISTS "Users can manage outlets in their organization" ON public.outlets;

DROP POLICY IF EXISTS "Admin can manage all staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Admin full access to staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Outlet users access staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff users access own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Users can view staff profiles in their organization" ON public.staff_profiles;
DROP POLICY IF EXISTS "Users can manage staff profiles in their organization" ON public.staff_profiles;

DROP POLICY IF EXISTS "Admin full access to assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Outlet users access assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Staff users access own assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Users can view task assignments in their organization" ON public.task_assignments;
DROP POLICY IF EXISTS "Users can manage task assignments in their organization" ON public.task_assignments;

DROP POLICY IF EXISTS "Admin can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin full access to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage tasks in their organization" ON public.tasks;

DROP POLICY IF EXISTS "Admin full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create clean, simple organization-based policies

-- Users table policies
CREATE POLICY "Users can view users in their organization" ON public.users
  FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Allow anon insert for signup" ON public.users
  FOR INSERT WITH CHECK (true);

-- Staff profiles table policies
CREATE POLICY "Users can view staff profiles in their organization" ON public.staff_profiles
  FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Users can manage staff profiles in their organization" ON public.staff_profiles
  FOR ALL USING (organization_id = current_user_organization_id()) 
  WITH CHECK (organization_id = current_user_organization_id());

-- Tasks table policies
CREATE POLICY "Users can view tasks in their organization" ON public.tasks
  FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Users can manage tasks in their organization" ON public.tasks
  FOR ALL USING (organization_id = current_user_organization_id()) 
  WITH CHECK (organization_id = current_user_organization_id());

-- Task assignments table policies
CREATE POLICY "Users can view task assignments in their organization" ON public.task_assignments
  FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Users can manage task assignments in their organization" ON public.task_assignments
  FOR ALL USING (organization_id = current_user_organization_id()) 
  WITH CHECK (organization_id = current_user_organization_id());

-- Outlets table policies
CREATE POLICY "Users can view outlets in their organization" ON public.outlets
  FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Users can manage outlets in their organization" ON public.outlets
  FOR ALL USING (organization_id = current_user_organization_id()) 
  WITH CHECK (organization_id = current_user_organization_id());

-- Monthly schedules table policies
CREATE POLICY "Users can view monthly schedules in their organization" ON public.monthly_schedules
  FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Users can manage monthly schedules in their organization" ON public.monthly_schedules
  FOR ALL USING (organization_id = current_user_organization_id()) 
  WITH CHECK (organization_id = current_user_organization_id());

-- Daily schedules table policies
CREATE POLICY "Users can view daily schedules in their organization" ON public.daily_schedules
  FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Users can manage daily schedules in their organization" ON public.daily_schedules
  FOR ALL USING (organization_id = current_user_organization_id()) 
  WITH CHECK (organization_id = current_user_organization_id());

-- Invitations table policies
DROP POLICY IF EXISTS "Allow public read invitations by token" ON public.invitations;
DROP POLICY IF EXISTS "Users can manage invitations in their organization" ON public.invitations;

CREATE POLICY "Allow public read invitations by token" ON public.invitations
  FOR SELECT USING (true);

CREATE POLICY "Users can manage invitations in their organization" ON public.invitations
  FOR ALL USING (organization_id = current_user_organization_id()) 
  WITH CHECK (organization_id = current_user_organization_id());

-- Organizations table policies (already exist, but ensure they're clean)
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow anon insert for organization creation" ON public.organizations;

CREATE POLICY "Users can view their own organization" ON public.organizations
  FOR SELECT USING (id = current_user_organization_id());

CREATE POLICY "Users can update their own organization" ON public.organizations
  FOR UPDATE USING (id = current_user_organization_id()) 
  WITH CHECK (id = current_user_organization_id());

CREATE POLICY "Allow anon insert for organization creation" ON public.organizations
  FOR INSERT WITH CHECK (true);

SELECT 'RLS policies cleaned up and recreated successfully.' as status;
