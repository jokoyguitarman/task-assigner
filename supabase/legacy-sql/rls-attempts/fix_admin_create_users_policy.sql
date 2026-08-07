-- Fix RLS policy to allow admins to create new users for staff enrollment

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;

-- Create a new policy that allows admins to create users
CREATE POLICY "Admin can create users" ON public.users
    FOR INSERT WITH CHECK (
        -- Allow service role to insert (for triggers)
        current_setting('role') = 'service_role'
        OR 
        -- Allow admins to create new users
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Also make sure admins can read all users (needed for staff management)
DROP POLICY IF EXISTS "Allow user lookup by ID" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;

-- Recreate a comprehensive read policy
CREATE POLICY "Users can read based on role" ON public.users
    FOR SELECT USING (
        -- Users can read their own profile
        auth.uid() = id
        OR
        -- Admins can read all users
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        -- Service role can read all
        current_setting('role') = 'service_role'
    );

-- Show current policies
SELECT 
    policyname,
    cmd,
    permissive,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY cmd, policyname;

SELECT 'Admin can now create users for staff enrollment!' as status;
