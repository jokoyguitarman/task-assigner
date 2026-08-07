-- Temporarily disable the trigger to test account creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

SELECT 'Triggers disabled - you can now test account creation' AS status;

-- To re-enable later, run the fix_trigger_error.sql script
