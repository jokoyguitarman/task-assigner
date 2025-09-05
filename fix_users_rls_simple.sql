-- Re-enable RLS on users table with a simpler policy
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow anon insert for signup" ON public.users;

-- Create simpler policies
CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Allow any authenticated user to read user data (simplified)
CREATE POLICY "Allow authenticated read" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Allow anonymous users to insert during signup
CREATE POLICY "Allow anon insert for signup" ON public.users
  FOR INSERT WITH CHECK (true);

SELECT 'Users RLS re-enabled with simplified policies.' as status;
