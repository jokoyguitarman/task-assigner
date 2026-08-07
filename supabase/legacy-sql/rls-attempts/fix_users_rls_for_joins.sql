-- Fix RLS policies to allow user data in joins
-- The issue is that staffProfilesAPI.getAll() joins with users table,
-- but RLS policies are blocking access to users data

-- Drop existing user policies
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view their own user profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can update their own user profile" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.users;

-- Create new policies that allow authenticated users to read user data for joins
CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view user data for joins" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Allow anon insert for signup" ON public.users
  FOR INSERT WITH CHECK (true);

SELECT 'Users RLS policies updated to allow joins.' as status;
