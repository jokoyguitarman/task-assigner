-- Simple fix: Just ensure the signup can work
-- Don't try to clean up existing data, just make sure new signups work

-- Check if there are any RLS policies blocking signup
SELECT 'Current RLS policies on users table:' as info;
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- Make sure anonymous users can insert into users table for signup
-- (This should already exist from our previous fixes)
SELECT 'RLS should allow anonymous signup - checking...' as info;




