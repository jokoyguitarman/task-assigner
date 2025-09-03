-- Fix daily_schedules table constraint for day_off_type
-- This script fixes the check constraint to allow NULL values properly

-- First, let's check the current constraint
-- SELECT conname, consrc FROM pg_constraint WHERE conrelid = 'public.daily_schedules'::regclass;

-- Drop the existing constraint if it exists
ALTER TABLE public.daily_schedules 
DROP CONSTRAINT IF EXISTS daily_schedules_day_off_type_check;

-- Create a proper constraint that allows NULL and empty string for work days
ALTER TABLE public.daily_schedules 
ADD CONSTRAINT daily_schedules_day_off_type_check 
CHECK (
  day_off_type IS NULL OR 
  day_off_type = '' OR 
  day_off_type IN ('vacation', 'sick', 'personal', 'other')
);

-- Also add a constraint to ensure logical consistency
ALTER TABLE public.daily_schedules 
DROP CONSTRAINT IF EXISTS daily_schedules_logic_check;

ALTER TABLE public.daily_schedules 
ADD CONSTRAINT daily_schedules_logic_check 
CHECK (
  -- If it's a day off, should not have outlet, time_in, or time_out
  (is_day_off = true AND outlet_id IS NULL AND time_in IS NULL AND time_out IS NULL) OR
  -- If it's not a day off, should have outlet, time_in, and time_out, and no day_off_type
  (is_day_off = false AND outlet_id IS NOT NULL AND time_in IS NOT NULL AND time_out IS NOT NULL AND (day_off_type IS NULL OR day_off_type = ''))
);

-- Verify the table structure
SELECT 'daily_schedules constraints updated successfully' as status;
