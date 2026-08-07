-- Remove the problematic outlet auth function and trigger with CASCADE
-- This will drop the function and all dependent triggers

-- First, let's see what triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'outlets';

-- Drop the function with CASCADE to remove dependent triggers
DROP FUNCTION IF EXISTS create_auth_user_for_outlet() CASCADE;

-- Also try to drop other possible function names with CASCADE
DROP FUNCTION IF EXISTS auto_create_auth_user_for_outlet() CASCADE;
DROP FUNCTION IF EXISTS create_auth_user_for_outlet() CASCADE;

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
