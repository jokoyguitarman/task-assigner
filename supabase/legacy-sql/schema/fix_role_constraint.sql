-- Fix the role check constraint to allow 'outlet' role
-- The current constraint probably only allows 'admin' and 'staff'

-- First, let's see what the current constraint allows
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
AND contype = 'c';

-- Drop the existing role check constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Create a new constraint that allows admin, staff, and outlet roles
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'staff', 'outlet'));

-- Show success message
SELECT 'Role constraint updated to allow admin, staff, and outlet roles!' as status;
