-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the helper functions to ensure they work properly
DROP FUNCTION IF EXISTS current_user_organization_id() CASCADE;
DROP FUNCTION IF EXISTS user_belongs_to_organization(UUID) CASCADE;

-- Create improved helper functions
CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Get organization_id from users table
  SELECT organization_id INTO org_id 
  FROM users 
  WHERE id = auth.uid();
  
  RETURN org_id;
END;
$$;

CREATE OR REPLACE FUNCTION user_belongs_to_organization(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND organization_id = org_id
  );
END;
$$;

-- Drop existing policies on organizations table
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow anon insert for organization creation" ON public.organizations;

-- Create simple RLS policy for organizations table
CREATE POLICY "Users can view their own organization" ON public.organizations
  FOR SELECT USING (id = current_user_organization_id());

CREATE POLICY "Users can update their own organization" ON public.organizations
  FOR UPDATE USING (id = current_user_organization_id()) 
  WITH CHECK (id = current_user_organization_id());

CREATE POLICY "Allow anon insert for organization creation" ON public.organizations
  FOR INSERT WITH CHECK (true);

-- Test the helper function
SELECT 'Testing helper function:' as test_type,
       current_user_organization_id() as result;

-- Check if user has organization_id
SELECT 'User organization check:' as check_type,
       u.id,
       u.email,
       u.role,
       u.organization_id,
       u.is_primary_admin
FROM users u 
WHERE u.id = auth.uid();

SELECT 'Organizations RLS enabled and policies created successfully.' as status;
