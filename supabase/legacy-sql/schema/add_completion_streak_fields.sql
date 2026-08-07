-- Add completion streak fields to users table
-- This implements the "clear the board" streak system

-- Add streak fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_clear_board_date DATE;

-- Add comments for clarity
COMMENT ON COLUMN users.current_streak IS 'Current consecutive days with zero pending/overdue tasks';
COMMENT ON COLUMN users.longest_streak IS 'Longest streak of consecutive clear board days';
COMMENT ON COLUMN users.last_clear_board_date IS 'Last date when user had zero pending/overdue tasks';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_streak ON users(current_streak);
CREATE INDEX IF NOT EXISTS idx_users_last_clear ON users(last_clear_board_date);
