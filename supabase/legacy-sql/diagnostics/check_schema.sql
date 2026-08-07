-- Check the actual schema of our tables
SELECT 'outlets table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'outlets' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'staff_profiles table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'staff_profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'users table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;
