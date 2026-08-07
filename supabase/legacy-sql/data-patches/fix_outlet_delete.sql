-- Fix outlet deletion issues
-- Check what's referencing the outlet that can't be deleted

-- Check foreign key constraints on outlets table
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (ccu.table_name = 'outlets' OR tc.table_name = 'outlets');

-- Check if there are any records referencing the outlet
SELECT 'staff_profiles' as table_name, COUNT(*) as referencing_records
FROM staff_profiles 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731'
UNION ALL
SELECT 'task_assignments' as table_name, COUNT(*) as referencing_records
FROM task_assignments 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731'
UNION ALL
SELECT 'daily_schedules' as table_name, COUNT(*) as referencing_records
FROM daily_schedules 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731'
UNION ALL
SELECT 'monthly_schedules' as table_name, COUNT(*) as referencing_records
FROM monthly_schedules 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Check the outlet details
SELECT * FROM outlets WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- If there are referencing records, we need to handle them first
-- Option 1: Set referencing records to NULL or different outlet
-- Option 2: Delete referencing records first
-- Option 3: Use CASCADE delete (if foreign keys support it)

-- For now, let's try to update the outlet to inactive and handle references
UPDATE outlets 
SET is_active = false, 
    name = name || ' (DELETED)',
    updated_at = NOW()
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Check if the update worked
SELECT * FROM outlets WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';
