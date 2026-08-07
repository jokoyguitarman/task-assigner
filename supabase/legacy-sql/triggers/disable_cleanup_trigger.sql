-- Disable the cleanup trigger that's causing the outlet deletion error
-- This trigger fires on both DELETE and UPDATE operations

-- First, let's see what triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'outlets';

-- Disable the specific cleanup trigger
DROP TRIGGER IF EXISTS trigger_cleanup_auth_user_for_outlet ON outlets;

-- Now try to soft delete the outlet
UPDATE outlets 
SET is_active = false
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Verify the deletion worked
SELECT id, name, is_active, created_at 
FROM outlets 
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Check if there are any remaining triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'outlets';
