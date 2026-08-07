-- Fix RLS policies for staff creation
-- This script allows admins to create new users in the users table

-- First, let's check current policies
-- \dp users;

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role has full access" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read all users" ON public.users;
DROP POLICY IF EXISTS "Admin can manage all users" ON public.users;

-- Create comprehensive RLS policies for the users table
-- 1. Allow authenticated users to view all users (needed for staff management)
CREATE POLICY "Authenticated users can read all users" ON public.users
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. Allow admins to insert new users (for staff creation)
CREATE POLICY "Admins can create users" ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Check if the current user is an admin
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 4. Allow admins to update any user
CREATE POLICY "Admins can update all users" ON public.users
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 5. Allow admins to delete users
CREATE POLICY "Admins can delete users" ON public.users
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 6. Service role has full access (for triggers and functions)
CREATE POLICY "Service role has full access" ON public.users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Make sure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Let's also check if we need similar policies for staff_profiles table
-- Allow authenticated users to read all staff profiles
DROP POLICY IF EXISTS "Authenticated users can read staff profiles" ON public.staff_profiles;
CREATE POLICY "Authenticated users can read staff profiles" ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow admins to create staff profiles
DROP POLICY IF EXISTS "Admins can create staff profiles" ON public.staff_profiles;
CREATE POLICY "Admins can create staff profiles" ON public.staff_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Allow admins to update staff profiles
DROP POLICY IF EXISTS "Admins can update staff profiles" ON public.staff_profiles;
CREATE POLICY "Admins can update staff profiles" ON public.staff_profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Allow staff to view and update their own profile
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff_profiles;
CREATE POLICY "Staff can view own profile" ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can update own profile" ON public.staff_profiles;
CREATE POLICY "Staff can update own profile" ON public.staff_profiles
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role has full access to staff_profiles
DROP POLICY IF EXISTS "Service role full access staff profiles" ON public.staff_profiles;
CREATE POLICY "Service role full access staff profiles" ON public.staff_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Make sure RLS is enabled on staff_profiles
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
