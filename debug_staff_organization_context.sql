-- Debug the staff user's organization context
SELECT 'Current user details:' as check_type,
       auth.uid() as user_id,
       auth.role() as auth_role;

-- Check the staff user's record in the users table
SELECT 'Staff user record:' as check_type,
       u.id,
       u.email,
       u.name,
       u.role,
       u.organization_id,
       u.is_primary_admin,
       u.created_at
FROM users u 
WHERE u.id = auth.uid();

-- Test the helper function
SELECT 'current_user_organization_id() result:' as check_type,
       current_user_organization_id() as organization_id;

-- Check if the organization exists
SELECT 'Organization exists:' as check_type,
       o.id,
       o.name,
       o.subscription_tier
FROM organizations o
WHERE o.id = current_user_organization_id();

-- Check if there are any users in the organization that the helper function returns
SELECT 'Users in organization from helper function:' as check_type,
       COUNT(*) as count
FROM users 
WHERE organization_id = current_user_organization_id();

-- Check if there are any users in the organization that the staff user's record points to
SELECT 'Users in staff user organization:' as check_type,
       COUNT(*) as count
FROM users u1
JOIN users u2 ON u1.organization_id = u2.organization_id
WHERE u2.id = auth.uid();

-- Check what organization_id the staff user actually has
SELECT 'Staff user organization_id value:' as check_type,
       u.organization_id as actual_organization_id
FROM users u 
WHERE u.id = auth.uid();

-- Check if that organization exists
SELECT 'Does staff user organization exist:' as check_type,
       CASE 
         WHEN EXISTS (SELECT 1 FROM organizations WHERE id = (SELECT organization_id FROM users WHERE id = auth.uid())) 
         THEN 'YES' 
         ELSE 'NO' 
       END as exists;
