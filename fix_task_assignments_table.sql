-- Fix task_assignments table to include missing columns
-- The table is missing outlet_id and organization_id columns that the form is trying to use

-- First, check the current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'task_assignments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
ALTER TABLE public.task_assignments 
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id),
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Update the table to make organization_id NOT NULL and add a default
-- First, let's see if there are any existing records
SELECT COUNT(*) as existing_assignments FROM task_assignments;

-- If there are existing records, we need to set a default organization_id
-- Let's get the first organization ID as default
UPDATE public.task_assignments 
SET organization_id = (
    SELECT id FROM public.organizations 
    ORDER BY created_at 
    LIMIT 1
)
WHERE organization_id IS NULL;

-- Now make organization_id NOT NULL
ALTER TABLE public.task_assignments 
ALTER COLUMN organization_id SET NOT NULL;

-- Verify the table structure now
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'task_assignments' 
AND table_schema = 'public'
ORDER BY ordinal_position;
