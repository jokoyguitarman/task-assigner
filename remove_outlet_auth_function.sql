-- Remove the problematic outlet auth function completely
-- This will prevent the confirmed_at column error

-- First, let's see what functions exist
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%outlet%' 
   OR routine_name LIKE '%auth%'
   OR routine_name LIKE '%user%'
ORDER BY routine_name;

-- Drop all possible trigger names
DROP TRIGGER IF EXISTS create_auth_user_for_outlet_trigger ON outlets;
DROP TRIGGER IF EXISTS auto_create_auth_user_for_outlet ON outlets;
DROP TRIGGER IF EXISTS create_auth_user_for_outlet ON outlets;
DROP TRIGGER IF EXISTS outlet_auth_user_trigger ON outlets;
DROP TRIGGER IF EXISTS create_auth_user_for_outlet_trigger ON outlets;

-- Drop the function that's causing the problem
DROP FUNCTION IF EXISTS create_auth_user_for_outlet();
DROP FUNCTION IF EXISTS auto_create_auth_user_for_outlet();
DROP FUNCTION IF EXISTS create_auth_user_for_outlet();

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
