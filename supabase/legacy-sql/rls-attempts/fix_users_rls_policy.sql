-- Fix RLS policy for users table to allow signup
-- The current policy only allows authenticated users to insert, but signup happens before authentication

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

-- Create new policies that allow signup
-- Policy: Allow anyone to insert during signup (for new user creation)
CREATE POLICY "Allow user signup" ON public.users
    FOR INSERT WITH CHECK (true);

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Admins can manage all users
CREATE POLICY "Admins can manage all users" ON public.users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Also fix the outlets table RLS for outlet creation
DROP POLICY IF EXISTS "Admins can manage outlets" ON public.outlets;
DROP POLICY IF EXISTS "Outlet users can view own outlet" ON public.outlets;

-- Create new policies for outlets
CREATE POLICY "Allow outlet creation" ON public.outlets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage outlets" ON public.outlets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Outlet users can view own outlet" ON public.outlets
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Fix staff_profiles table RLS for staff creation
DROP POLICY IF EXISTS "Admins can manage staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff_profiles;

-- Create new policies for staff_profiles
CREATE POLICY "Allow staff creation" ON public.staff_profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage staff profiles" ON public.staff_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Staff can view own profile" ON public.staff_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );










