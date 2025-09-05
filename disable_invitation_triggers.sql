-- Disable any triggers on invitations table that might be creating users
-- This will prevent automatic user creation during invitation

-- First, let's see what triggers exist on invitations
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'invitations'
ORDER BY trigger_name;

-- Disable all triggers on invitations table
DROP TRIGGER IF EXISTS create_user_for_invitation_trigger ON invitations;
DROP TRIGGER IF EXISTS auto_create_user_for_invitation ON invitations;
DROP TRIGGER IF EXISTS create_user_for_invitation ON invitations;
DROP TRIGGER IF EXISTS invitation_user_trigger ON invitations;

-- Check if there are any remaining triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invitations';
