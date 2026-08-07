-- Fix existing overdue assignments that were incorrectly marked as overdue
-- This will reset them back to pending status so they can be re-evaluated with the new logic

-- First, let's see what assignments are currently marked as overdue
SELECT 
    id,
    task_id,
    staff_id,
    due_date,
    status,
    assigned_date,
    created_at
FROM task_assignments 
WHERE status = 'overdue'
ORDER BY due_date DESC;

-- Check if any of these "overdue" assignments are actually due today or in the future
SELECT 
    id,
    task_id,
    staff_id,
    due_date,
    status,
    assigned_date,
    CASE 
        WHEN due_date >= CURRENT_DATE THEN 'SHOULD_BE_PENDING'
        ELSE 'ACTUALLY_OVERDUE'
    END as should_be_status
FROM task_assignments 
WHERE status = 'overdue'
ORDER BY due_date DESC;

-- Reset assignments that are due today or in the future back to pending
-- This will allow the new logic to re-evaluate them correctly
UPDATE task_assignments 
SET status = 'pending'
WHERE status = 'overdue' 
AND due_date >= CURRENT_DATE;

-- Check the results after the update
SELECT 
    id,
    task_id,
    staff_id,
    due_date,
    status,
    assigned_date
FROM task_assignments 
WHERE status IN ('pending', 'overdue')
ORDER BY due_date DESC;
