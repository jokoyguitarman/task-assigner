-- Fix the trigger error - the trigger should be on auth.users, not public.users
-- Let's recreate the trigger correctly

-- First, drop the existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user into public.users table with error handling
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
      -- Add your admin emails here (replace with your actual email)
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
    COALESCE(NEW.updated_at, NEW.created_at)
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate key errors
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE LOG 'Error creating user profile for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users (this is the correct table)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Check if the trigger was created successfully
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Also check current users table structure to make sure it's correct
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;
