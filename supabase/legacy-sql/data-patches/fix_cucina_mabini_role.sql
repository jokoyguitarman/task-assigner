-- Fix Cucina Mabini user role from 'staff' to 'outlet'
-- This will make the system recognize them as an outlet user

-- First, let's check the current user data
SELECT id, email, name, role, created_at, updated_at 
FROM public.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- Update the role from 'staff' to 'outlet'
UPDATE public.users 
SET role = 'outlet', updated_at = NOW()
WHERE email = 'jokoyguitarman@yahoo.com';

-- Verify the change
SELECT id, email, name, role, created_at, updated_at 
FROM public.users 
WHERE email = 'jokoyguitarman@yahoo.com';

-- Also check if there's an outlet record linked to this user
SELECT id, name, user_id, created_at
FROM public.outlets 
WHERE user_id = '7df0cde8-a5c6-4ce2-8743-c8910066578f';

-- If no outlet record exists, we need to create one
-- First, let's see what outlets exist
SELECT id, name, user_id, created_at
FROM public.outlets 
WHERE name ILIKE '%cucina%' OR name ILIKE '%mabini%';
