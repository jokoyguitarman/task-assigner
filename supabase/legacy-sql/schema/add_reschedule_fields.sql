-- Add reschedule fields to task_assignments table
-- This script adds columns to support reschedule requests from staff members

-- Add reschedule_requested_at column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_assignments' AND column_name='reschedule_requested_at') THEN
        ALTER TABLE public.task_assignments ADD COLUMN reschedule_requested_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add reschedule_reason column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_assignments' AND column_name='reschedule_reason') THEN
        ALTER TABLE public.task_assignments ADD COLUMN reschedule_reason TEXT;
    END IF;
END $$;

-- Add reschedule_requested_by column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_assignments' AND column_name='reschedule_requested_by') THEN
        ALTER TABLE public.task_assignments ADD COLUMN reschedule_requested_by UUID REFERENCES public.users(id);
    END IF;
END $$;

-- Add reschedule_approved_at column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_assignments' AND column_name='reschedule_approved_at') THEN
        ALTER TABLE public.task_assignments ADD COLUMN reschedule_approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add reschedule_approved_by column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_assignments' AND column_name='reschedule_approved_by') THEN
        ALTER TABLE public.task_assignments ADD COLUMN reschedule_approved_by UUID REFERENCES public.users(id);
    END IF;
END $$;

-- Add reschedule_new_due_date column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_assignments' AND column_name='reschedule_new_due_date') THEN
        ALTER TABLE public.task_assignments ADD COLUMN reschedule_new_due_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Update the status constraint to include 'reschedule_requested'
DO $$ BEGIN
    -- First drop the existing constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'task_assignments_status_check') THEN
        ALTER TABLE public.task_assignments DROP CONSTRAINT task_assignments_status_check;
    END IF;
    
    -- Add the new constraint with reschedule_requested status
    ALTER TABLE public.task_assignments ADD CONSTRAINT task_assignments_status_check 
    CHECK (status IN ('pending', 'completed', 'overdue', 'reschedule_requested'));
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_assignments_reschedule_requested_at ON public.task_assignments (reschedule_requested_at);
CREATE INDEX IF NOT EXISTS idx_task_assignments_reschedule_requested_by ON public.task_assignments (reschedule_requested_by);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status_reschedule ON public.task_assignments (status) WHERE status = 'reschedule_requested';

-- Add comments for documentation
COMMENT ON COLUMN public.task_assignments.reschedule_requested_at IS 'Timestamp when reschedule was requested';
COMMENT ON COLUMN public.task_assignments.reschedule_reason IS 'Reason provided by staff for requesting reschedule';
COMMENT ON COLUMN public.task_assignments.reschedule_requested_by IS 'Staff member who requested the reschedule';
COMMENT ON COLUMN public.task_assignments.reschedule_approved_at IS 'Timestamp when reschedule was approved/rejected by admin';
COMMENT ON COLUMN public.task_assignments.reschedule_approved_by IS 'Admin who approved/rejected the reschedule';
COMMENT ON COLUMN public.task_assignments.reschedule_new_due_date IS 'New due date if reschedule was approved';
