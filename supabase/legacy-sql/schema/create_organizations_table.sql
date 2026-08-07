-- Create organizations table for multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'standard', 'professional')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'expired')),
  max_admins INTEGER DEFAULT 1,
  max_restaurants INTEGER DEFAULT 1,
  max_employees INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create default organization for existing data
INSERT INTO organizations (id, name, subscription_tier, max_admins, max_restaurants, max_employees)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Cucina Ilocana',
  'professional',
  5,
  7,
  70
) ON CONFLICT (id) DO NOTHING;

-- Add organization_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN DEFAULT FALSE;

-- Add organization_id to outlets table
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add organization_id to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add organization_id to task_assignments table
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add organization_id to staff_profiles table
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add organization_id to monthly_schedules table
ALTER TABLE monthly_schedules ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add organization_id to daily_schedules table
ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add organization_id to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Update existing data to belong to default organization
UPDATE users SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE outlets SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE tasks SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE task_assignments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE staff_profiles SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE monthly_schedules SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE daily_schedules SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE invitations SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Set primary admin for existing data
UPDATE users SET is_primary_admin = TRUE WHERE role = 'admin' AND organization_id = '00000000-0000-0000-0000-000000000001' AND id = (SELECT id FROM users WHERE role = 'admin' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_outlets_organization_id ON outlets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_organization_id ON task_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_organization_id ON staff_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_organization_id ON monthly_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_organization_id ON daily_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);

SELECT 'Organizations table created and existing data migrated successfully.' as status;
