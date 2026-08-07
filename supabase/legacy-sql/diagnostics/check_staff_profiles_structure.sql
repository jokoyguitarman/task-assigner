-- Check the actual structure of staff_profiles table
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'staff_profiles'
ORDER BY ordinal_position;

-- Check if there's a different column name for outlet reference
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'staff_profiles' 
AND column_name LIKE '%outlet%'
ORDER BY ordinal_position;
