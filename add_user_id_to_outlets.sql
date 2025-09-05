-- Add user_id column to outlets table to link outlets to auth users
ALTER TABLE public.outlets 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_outlets_user_id ON public.outlets(user_id);

-- Add comment
COMMENT ON COLUMN public.outlets.user_id IS 'Link to auth.users for outlet login via invitation system';





