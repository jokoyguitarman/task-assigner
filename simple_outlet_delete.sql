-- Simple outlet deletion without triggering auth user creation
-- This script just soft deletes the outlet without any complex operations

-- First, let's see what we're working with
SELECT id, name, is_active, created_at 
FROM outlets 
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Check if there are any foreign key references
SELECT 'task_assignments' as table_name, COUNT(*) as count
FROM task_assignments 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731'
UNION ALL
SELECT 'daily_schedules' as table_name, COUNT(*) as count
FROM daily_schedules 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- If there are references, clear them first
UPDATE task_assignments 
SET outlet_id = NULL 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

UPDATE daily_schedules 
SET outlet_id = NULL 
WHERE outlet_id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Now soft delete the outlet
UPDATE outlets 
SET is_active = false
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Verify the deletion worked
SELECT id, name, is_active, created_at 
FROM outlets 
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';
