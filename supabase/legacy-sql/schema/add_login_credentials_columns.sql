-- Add login credentials columns to outlets and staff_profiles tables

-- Add username and password columns to outlets table
ALTER TABLE outlets 
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;

-- Add username and password columns to staff_profiles table  
ALTER TABLE staff_profiles
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;

-- Add indexes for faster username lookups
CREATE INDEX IF NOT EXISTS idx_outlets_username ON outlets(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_profiles_username ON staff_profiles(username) WHERE username IS NOT NULL;

-- Add unique constraints to ensure usernames are unique within each table
-- (Only if username is provided)
ALTER TABLE outlets ADD CONSTRAINT unique_outlet_username UNIQUE (username);
ALTER TABLE staff_profiles ADD CONSTRAINT unique_staff_username UNIQUE (username);

-- Comments for documentation
COMMENT ON COLUMN outlets.username IS 'Optional username for outlet login access';
COMMENT ON COLUMN outlets.password IS 'Optional password for outlet login access';
COMMENT ON COLUMN staff_profiles.username IS 'Optional username for staff login access';
COMMENT ON COLUMN staff_profiles.password IS 'Optional password for staff login access';
