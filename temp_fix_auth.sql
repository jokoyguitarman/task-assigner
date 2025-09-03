-- Temporary fix: Grant direct access to bypass policy issues
-- This is just for testing - you can revert it later

-- Grant anon role direct access to users table
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Also grant usage on the sequence if it exists
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Test query
SELECT 'Permission granted - try logging in now' as status;
