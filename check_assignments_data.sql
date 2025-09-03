-- Check if assignments exist and what the data looks like
-- This will help us debug why the API isn't returning data

-- 1. Check if the table exists and has data
SELECT COUNT(*) as total_assignments FROM task_assignments;

-- 2. Show all assignments with their outlet information
SELECT 
    ta.id,
    ta.task_id,
    ta.staff_id,
    ta.outlet_id,
    ta.status,
    ta.assigned_date,
    ta.due_date,
    o.name as outlet_name
FROM task_assignments ta
LEFT JOIN outlets o ON ta.outlet_id = o.id
ORDER BY ta.created_at DESC;

-- 3. Check specifically for Cucina Mabini assignments
SELECT 
    ta.id,
    ta.task_id,
    ta.staff_id,
    ta.outlet_id,
    ta.status,
    ta.assigned_date,
    ta.due_date,
    o.name as outlet_name
FROM task_assignments ta
LEFT JOIN outlets o ON ta.outlet_id = o.id
WHERE ta.outlet_id = '7aa0e882-bcb7-43c1-a928-d1babbff7984';

-- 4. Check RLS policies on task_assignments table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'task_assignments' 
AND schemaname = 'public';
