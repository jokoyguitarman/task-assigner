-- Create functions to check tier limits

-- Function to get organization tier limits
CREATE OR REPLACE FUNCTION get_organization_limits(org_id UUID)
RETURNS TABLE(
  max_admins INTEGER,
  max_restaurants INTEGER,
  max_employees INTEGER,
  current_admins BIGINT,
  current_restaurants BIGINT,
  current_employees BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.max_admins,
    o.max_restaurants,
    o.max_employees,
    (SELECT COUNT(*) FROM users WHERE organization_id = org_id AND role = 'admin'),
    (SELECT COUNT(*) FROM outlets WHERE organization_id = org_id AND is_active = true),
    (SELECT COUNT(*) FROM users WHERE organization_id = org_id)
  FROM organizations o
  WHERE o.id = org_id;
END;
$$;

-- Function to check if user can add admin
CREATE OR REPLACE FUNCTION can_add_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  limits RECORD;
BEGIN
  SELECT * INTO limits FROM get_organization_limits(org_id);
  RETURN limits.current_admins < limits.max_admins;
END;
$$;

-- Function to check if user can add restaurant/outlet
CREATE OR REPLACE FUNCTION can_add_restaurant(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  limits RECORD;
BEGIN
  SELECT * INTO limits FROM get_organization_limits(org_id);
  RETURN limits.current_restaurants < limits.max_restaurants;
END;
$$;

-- Function to check if user can add employee
CREATE OR REPLACE FUNCTION can_add_employee(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  limits RECORD;
BEGIN
  SELECT * INTO limits FROM get_organization_limits(org_id);
  RETURN limits.current_employees < limits.max_employees;
END;
$$;

-- Function to get usage stats for sidebar
CREATE OR REPLACE FUNCTION get_organization_usage_stats(org_id UUID)
RETURNS TABLE(
  admins_used INTEGER,
  admins_max INTEGER,
  restaurants_used INTEGER,
  restaurants_max INTEGER,
  employees_used INTEGER,
  employees_max INTEGER,
  subscription_tier VARCHAR(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM users WHERE organization_id = org_id AND role = 'admin'),
    o.max_admins,
    (SELECT COUNT(*)::INTEGER FROM outlets WHERE organization_id = org_id AND is_active = true),
    o.max_restaurants,
    (SELECT COUNT(*)::INTEGER FROM users WHERE organization_id = org_id AND role != 'admin'),
    o.max_employees,
    o.subscription_tier
  FROM organizations o
  WHERE o.id = org_id;
END;
$$;

SELECT 'Tier limits functions created successfully.' as status;
