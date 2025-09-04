-- Safe RLS fix that handles existing policies
-- This will work even if some policies already exist

-- Fix users table RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Allow user signup" ON public.users;

-- Allow anyone to insert during signup
CREATE POLICY "Allow user signup" ON public.users
    FOR INSERT WITH CHECK (true);

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Admins can manage all users
CREATE POLICY "Admins can manage all users" ON public.users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Fix outlets table RLS
DROP POLICY IF EXISTS "Admins can manage outlets" ON public.outlets;
DROP POLICY IF EXISTS "Allow outlet creation" ON public.outlets;

-- Allow outlet creation during signup
CREATE POLICY "Allow outlet creation" ON public.outlets
    FOR INSERT WITH CHECK (true);

-- Admins can manage outlets
CREATE POLICY "Admins can manage outlets" ON public.outlets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Fix staff_profiles table RLS
DROP POLICY IF EXISTS "Admins can manage staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "Allow staff creation" ON public.staff_profiles;

-- Allow staff creation during signup
CREATE POLICY "Allow staff creation" ON public.staff_profiles
    FOR INSERT WITH CHECK (true);

-- Admins can manage staff profiles
CREATE POLICY "Admins can manage staff profiles" ON public.staff_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Staff can view their own profile
CREATE POLICY "Staff can view own profile" ON public.staff_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Show success message
SELECT 'RLS policies updated successfully!' as status;




