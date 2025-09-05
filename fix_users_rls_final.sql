-- Re-enable RLS on users table with proper policies for joins
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view user data for joins" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.users;

-- Create new policies that work with our helper functions
CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Allow authenticated users to read user data (needed for staff profile joins)
CREATE POLICY "Authenticated users can read user data" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Allow anonymous users to insert during signup
CREATE POLICY "Allow anon insert for signup" ON public.users
  FOR INSERT WITH CHECK (true);

SELECT 'Users RLS re-enabled with proper policies for joins.' as status;
