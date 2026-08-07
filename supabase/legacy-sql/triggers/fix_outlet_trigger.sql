-- Fix the outlet trigger that's causing the auth.users insert error
-- The trigger is trying to insert into confirmed_at which is a generated column

-- First, let's see what triggers exist on outlets
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'outlets';

-- Drop the problematic trigger if it exists
DROP TRIGGER IF EXISTS create_auth_user_for_outlet_trigger ON outlets;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS create_auth_user_for_outlet();

-- Create a corrected function that doesn't try to insert into generated columns
CREATE OR REPLACE FUNCTION create_auth_user_for_outlet()
RETURNS TRIGGER AS $$
DECLARE
    fake_email TEXT;
    auth_user_id UUID;
BEGIN
    -- Generate a fake email for the outlet
    fake_email := 'outlet_' || NEW.id || '@outlet.local';
    
    -- Insert into auth.users without the generated column
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        role,
        aud,
        confirmation_token,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        recovery_token,
        email_change_token_new,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        phone,
        phone_confirmed_at,
        phone_change_token,
        phone_change_sent_at
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        fake_email,
        crypt(NEW.password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated',
        '',
        '',
        0,
        NULL,
        '',
        '',
        NULL,
        NULL,
        jsonb_build_object('provider', 'outlet', 'outlet_id', NEW.id),
        jsonb_build_object('username', NEW.username, 'outlet_name', NEW.name, 'type', 'outlet'),
        FALSE,
        NULL,
        NULL,
        '',
        NULL
    ) RETURNING id INTO auth_user_id;
    
    -- Update the outlet with the auth user id
    NEW.auth_user_id := auth_user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER create_auth_user_for_outlet_trigger
    BEFORE INSERT ON outlets
    FOR EACH ROW
    EXECUTE FUNCTION create_auth_user_for_outlet();
