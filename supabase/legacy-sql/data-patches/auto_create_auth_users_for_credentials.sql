-- Automatically create Supabase Auth users when username/password are added to outlets or staff_profiles

-- Function to create auth user from outlet credentials
CREATE OR REPLACE FUNCTION create_auth_user_for_outlet()
RETURNS TRIGGER AS $$
DECLARE
    auth_user_id UUID;
    fake_email TEXT;
BEGIN
    -- Only create auth user if username and password are provided
    IF NEW.username IS NOT NULL AND NEW.password IS NOT NULL AND NEW.username != '' AND NEW.password != '' THEN
        -- Create a fake email for the outlet (Supabase Auth requires email)
        fake_email := NEW.username || '+outlet@taskassigner.local';
        
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
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            fake_email,
            crypt(NEW.password, gen_salt('bf')), -- Hash the password
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
            NULL,
            NOW()
        ) RETURNING id INTO auth_user_id;

        -- Also create a user record in the public.users table
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
            NEW.name || ' (Outlet)',
            'staff', -- Outlets use staff dashboard
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created auth user for outlet: % with email: %', NEW.name, fake_email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create auth user from staff credentials
CREATE OR REPLACE FUNCTION create_auth_user_for_staff()
RETURNS TRIGGER AS $$
DECLARE
    auth_user_id UUID;
    fake_email TEXT;
    staff_name TEXT;
BEGIN
    -- Only create auth user if username and password are provided
    IF NEW.username IS NOT NULL AND NEW.password IS NOT NULL AND NEW.username != '' AND NEW.password != '' THEN
        -- Get staff name from related user record
        SELECT name INTO staff_name FROM public.users WHERE id = NEW.user_id;
        IF staff_name IS NULL THEN
            staff_name := 'Staff Member';
        END IF;
        
        -- Create a fake email for the staff member
        fake_email := NEW.username || '+staff@taskassigner.local';
        
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
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            fake_email,
            crypt(NEW.password, gen_salt('bf')), -- Hash the password
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
            jsonb_build_object('provider', 'staff', 'staff_profile_id', NEW.id),
            jsonb_build_object('username', NEW.username, 'staff_name', staff_name, 'type', 'staff', 'employee_id', NEW.employee_id),
            FALSE,
            NULL,
            NULL,
            '',
            NULL,
            NOW()
        ) RETURNING id INTO auth_user_id;

        -- Also create a user record in the public.users table
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
            staff_name || ' (' || NEW.employee_id || ')',
            'staff',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created auth user for staff: % with email: %', staff_name, fake_email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up auth users when credentials are removed
CREATE OR REPLACE FUNCTION cleanup_auth_user_for_outlet()
RETURNS TRIGGER AS $$
DECLARE
    fake_email TEXT;
    auth_user_id UUID;
BEGIN
    -- If username is being removed or changed, clean up old auth user
    IF OLD.username IS NOT NULL AND OLD.username != '' THEN
        fake_email := OLD.username || '+outlet@taskassigner.local';
        
        -- Find and delete the auth user
        SELECT id INTO auth_user_id FROM auth.users WHERE email = fake_email;
        IF auth_user_id IS NOT NULL THEN
            DELETE FROM public.users WHERE id = auth_user_id;
            DELETE FROM auth.users WHERE id = auth_user_id;
            RAISE NOTICE 'Cleaned up auth user for outlet: %', OLD.name;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_auth_user_for_staff()
RETURNS TRIGGER AS $$
DECLARE
    fake_email TEXT;
    auth_user_id UUID;
BEGIN
    -- If username is being removed or changed, clean up old auth user
    IF OLD.username IS NOT NULL AND OLD.username != '' THEN
        fake_email := OLD.username || '+staff@taskassigner.local';
        
        -- Find and delete the auth user
        SELECT id INTO auth_user_id FROM auth.users WHERE email = fake_email;
        IF auth_user_id IS NOT NULL THEN
            DELETE FROM public.users WHERE id = auth_user_id;
            DELETE FROM auth.users WHERE id = auth_user_id;
            RAISE NOTICE 'Cleaned up auth user for staff: %', OLD.username;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for outlets
DROP TRIGGER IF EXISTS trigger_create_auth_user_for_outlet ON outlets;
CREATE TRIGGER trigger_create_auth_user_for_outlet
    AFTER INSERT OR UPDATE ON outlets
    FOR EACH ROW
    EXECUTE FUNCTION create_auth_user_for_outlet();

DROP TRIGGER IF EXISTS trigger_cleanup_auth_user_for_outlet ON outlets;
CREATE TRIGGER trigger_cleanup_auth_user_for_outlet
    BEFORE UPDATE OR DELETE ON outlets
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_auth_user_for_outlet();

-- Create triggers for staff_profiles
DROP TRIGGER IF EXISTS trigger_create_auth_user_for_staff ON staff_profiles;
CREATE TRIGGER trigger_create_auth_user_for_staff
    AFTER INSERT OR UPDATE ON staff_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_auth_user_for_staff();

DROP TRIGGER IF EXISTS trigger_cleanup_auth_user_for_staff ON staff_profiles;
CREATE TRIGGER trigger_cleanup_auth_user_for_staff
    BEFORE UPDATE OR DELETE ON staff_profiles
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_auth_user_for_staff();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, service_role;
GRANT ALL ON auth.users TO postgres, service_role;
