-- Add is_high_priority column to tasks table
-- This migration adds a boolean field to track high priority tasks

-- Add the is_high_priority column to the tasks table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'is_high_priority') THEN
        ALTER TABLE tasks ADD COLUMN is_high_priority BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- Add a comment to document the column
COMMENT ON COLUMN tasks.is_high_priority IS 'Indicates if this task is marked as high priority';

-- Create indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(is_high_priority);
CREATE INDEX IF NOT EXISTS idx_tasks_high_priority ON tasks(id) WHERE is_high_priority = TRUE;
