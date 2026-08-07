-- Corrected fix for outlet deletion
-- This script uses the correct column names for the outlets table

-- First, check the actual structure of the outlets table
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'outlets'
ORDER BY ordinal_position;

-- Check what's preventing the outlet deletion
-- Look for foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name = 'outlets';

-- Check if there are any records in task_assignments that reference this outlet
SELECT COUNT(*) as task_assignments_count
FROM task_assignments 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Check if there are any records in daily_schedules that reference this outlet
SELECT COUNT(*) as daily_schedules_count
FROM daily_schedules 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- If there are referencing records, we need to handle them
-- Try to update task_assignments to remove outlet reference
UPDATE task_assignments 
SET outlet_id = NULL 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Try to update daily_schedules to remove outlet reference
UPDATE daily_schedules 
SET outlet_id = NULL 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Now try to soft delete the outlet (without updated_at column)
UPDATE outlets 
SET is_active = false
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Check if the update worked
SELECT id, name, is_active, created_at 
FROM outlets 
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';
