-- Fix the employee count in usage stats function
-- The issue was that it was counting ALL users (including admins) as employees
-- Now it only counts non-admin users as employees

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
