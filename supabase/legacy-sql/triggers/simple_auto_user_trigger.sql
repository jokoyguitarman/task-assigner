-- Simple trigger to automatically create user profiles on signup
-- This is a minimal version that just handles the basics

-- Create the function that will run when new users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    -- Get name from user metadata or use email username
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    -- Simple role assignment - modify the email below
    CASE 
      WHEN NEW.email = 'youradmin@email.com' THEN 'admin'  -- Change this to your email
      ELSE 'staff'
    END,
    NEW.created_at,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger was created
SELECT 'Trigger created successfully!' AS status;
