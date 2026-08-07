-- Temporarily disable the outlet trigger to allow deletion
-- This will prevent the auth user creation error

-- Disable the trigger
DROP TRIGGER IF EXISTS create_auth_user_for_outlet_trigger ON outlets;

-- Now we can safely delete the outlet
UPDATE outlets 
SET is_active = false
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Verify the deletion worked
SELECT id, name, is_active, created_at 
FROM outlets 
WHERE id = '62b4546f-2f7e-4441-86bc-19ca8c2ff731';

-- Note: The trigger is now disabled. If you need it back, run the fix_outlet_trigger.sql script
