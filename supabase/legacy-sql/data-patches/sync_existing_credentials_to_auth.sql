-- One-time migration to sync existing username/password credentials to auth.users
-- This will create Supabase Auth users for outlets and staff that already have login credentials

-- Function to safely create auth users (won't fail if user already exists)
CREATE OR REPLACE FUNCTION sync_existing_outlet_to_auth(
    outlet_row RECORD
) RETURNS VOID AS $$
DECLARE
    auth_user_id UUID;
    fake_email TEXT;
    existing_user_id UUID;
BEGIN
    -- Skip if no credentials
    IF outlet_row.username IS NULL OR outlet_row.password IS NULL OR 
       outlet_row.username = '' OR outlet_row.password = '' THEN
        RAISE NOTICE 'Skipping outlet % - no credentials', outlet_row.name;
        RETURN;
    END IF;
    
    -- Create fake email
    fake_email := outlet_row.username || '+outlet@taskassigner.local';
    
    -- Check if auth user already exists
    SELECT id INTO existing_user_id FROM auth.users WHERE email = fake_email;
    
    IF existing_user_id IS NOT NULL THEN
        RAISE NOTICE 'Auth user already exists for outlet % (email: %)', outlet_row.name, fake_email;
        RETURN;
    END IF;
    
    -- Generate new UUID for auth user
    auth_user_id := gen_random_uuid();
    
    BEGIN
        -- Insert into auth.users table
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
            phone_change_sent_at,
            confirmed_at
        ) VALUES (
            auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            fake_email,
            crypt(outlet_row.password, gen_salt('bf')), -- Hash the password
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
            jsonb_build_object('provider', 'outlet', 'outlet_id', outlet_row.id, 'synced_from_existing', true),
            jsonb_build_object('username', outlet_row.username, 'outlet_name', outlet_row.name, 'type', 'outlet'),
            FALSE,
            NULL,
            NULL,
            '',
            NULL,
            NOW()
        );

        -- Create corresponding public.users record
        INSERT INTO public.users (
            id,
            email,
            name,
            role,
            created_at,
            updated_at
        ) VALUES (
            auth_user_id,
            fake_email,
            outlet_row.name || ' (Outlet)',
            'staff', -- Outlets use staff dashboard
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Successfully created auth user for outlet: % (username: %, email: %)', 
                     outlet_row.name, outlet_row.username, fake_email;
                     
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating auth user for outlet %: %', outlet_row.name, SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync staff profiles
CREATE OR REPLACE FUNCTION sync_existing_staff_to_auth(
    staff_row RECORD
) RETURNS VOID AS $$
DECLARE
    auth_user_id UUID;
    fake_email TEXT;
    existing_user_id UUID;
    staff_name TEXT;
    related_user RECORD;
BEGIN
    -- Skip if no credentials
    IF staff_row.username IS NULL OR staff_row.password IS NULL OR 
       staff_row.username = '' OR staff_row.password = '' THEN
        RAISE NOTICE 'Skipping staff profile % - no credentials', staff_row.employee_id;
        RETURN;
    END IF;
    
    -- Get staff name from related user record
    SELECT * INTO related_user FROM public.users WHERE id = staff_row.user_id;
    staff_name := COALESCE(related_user.name, 'Staff Member');
    
    -- Create fake email
    fake_email := staff_row.username || '+staff@taskassigner.local';
    
    -- Check if auth user already exists
    SELECT id INTO existing_user_id FROM auth.users WHERE email = fake_email;
    
    IF existing_user_id IS NOT NULL THEN
        RAISE NOTICE 'Auth user already exists for staff % (email: %)', staff_name, fake_email;
        RETURN;
    END IF;
    
    -- Generate new UUID for auth user
    auth_user_id := gen_random_uuid();
    
    BEGIN
        -- Insert into auth.users table
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
            phone_change_sent_at,
            confirmed_at
        ) VALUES (
            auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            fake_email,
            crypt(staff_row.password, gen_salt('bf')), -- Hash the password
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
            jsonb_build_object('provider', 'staff', 'staff_profile_id', staff_row.id, 'synced_from_existing', true),
            jsonb_build_object('username', staff_row.username, 'staff_name', staff_name, 'type', 'staff', 'employee_id', staff_row.employee_id),
            FALSE,
            NULL,
            NULL,
            '',
            NULL,
            NOW()
        );

        -- Create corresponding public.users record
        INSERT INTO public.users (
            id,
            email,
            name,
            role,
            created_at,
            updated_at
        ) VALUES (
            auth_user_id,
            fake_email,
            staff_name || ' (' || staff_row.employee_id || ')',
            'staff',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Successfully created auth user for staff: % (username: %, email: %)', 
                     staff_name, staff_row.username, fake_email;
                     
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating auth user for staff %: %', staff_name, SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the migration
DO $$
DECLARE
    outlet_rec RECORD;
    staff_rec RECORD;
    outlet_count INTEGER := 0;
    staff_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting sync of existing credentials to auth.users...';
    
    -- Sync all outlets with credentials
    FOR outlet_rec IN 
        SELECT * FROM outlets 
        WHERE username IS NOT NULL AND username != '' 
          AND password IS NOT NULL AND password != ''
          AND is_active = true
    LOOP
        PERFORM sync_existing_outlet_to_auth(outlet_rec);
        outlet_count := outlet_count + 1;
    END LOOP;
    
    -- Sync all staff profiles with credentials
    FOR staff_rec IN 
        SELECT * FROM staff_profiles 
        WHERE username IS NOT NULL AND username != '' 
          AND password IS NOT NULL AND password != ''
          AND is_active = true
    LOOP
        PERFORM sync_existing_staff_to_auth(staff_rec);
        staff_count := staff_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Migration completed! Processed % outlets and % staff profiles', outlet_count, staff_count;
END;
$$;

-- Clean up the temporary functions (optional)
-- DROP FUNCTION IF EXISTS sync_existing_outlet_to_auth(RECORD);
-- DROP FUNCTION IF EXISTS sync_existing_staff_to_auth(RECORD);

-- Show summary of what was created
SELECT 
    'Summary of synced credentials:' as info,
    COUNT(*) as total_auth_users_created
FROM auth.users 
WHERE raw_app_meta_data->>'synced_from_existing' = 'true';

SELECT 
    'Outlet auth users created:' as type,
    COUNT(*) as count
FROM auth.users 
WHERE raw_app_meta_data->>'provider' = 'outlet' 
  AND raw_app_meta_data->>'synced_from_existing' = 'true';

SELECT 
    'Staff auth users created:' as type,
    COUNT(*) as count
FROM auth.users 
WHERE raw_app_meta_data->>'provider' = 'staff' 
  AND raw_app_meta_data->>'synced_from_existing' = 'true';
