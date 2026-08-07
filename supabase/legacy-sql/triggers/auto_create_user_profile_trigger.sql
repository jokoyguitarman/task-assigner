-- SQL Trigger to automatically create user profiles when new auth users are created
-- This will run every time someone signs up through Supabase Auth

-- First, create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user into public.users table
  INSERT INTO public.users (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    -- Try to get name from metadata, fallback to email username
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    -- Assign role based on email or default to 'staff'
    CASE 
      -- Add your admin emails here
      WHEN NEW.email IN (
        'admin@yourcompany.com',
        'manager@yourcompany.com',
        'youremail@domain.com'  -- Replace with your actual admin email
      ) THEN 'admin'
      -- Anyone with 'admin' in their email
      WHEN NEW.email LIKE '%admin%' THEN 'admin'
      -- Anyone with 'manager' in their email
      WHEN NEW.email LIKE '%manager%' THEN 'admin'
      -- Default role for everyone else
      ELSE 'staff'
    END,
    NEW.created_at,
    NEW.updated_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that fires when a new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optional: Also handle updates to auth.users (in case user metadata changes)
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user profile if it exists
  UPDATE public.users 
  SET 
    email = NEW.email,
    name = COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      public.users.name,  -- Keep existing name if no metadata
      SPLIT_PART(NEW.email, '@', 1)
    ),
    updated_at = NEW.updated_at
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Test the trigger by showing current setup
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_updated');
