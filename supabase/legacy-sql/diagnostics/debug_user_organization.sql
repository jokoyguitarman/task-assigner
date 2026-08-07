-- Debug user organization ID issue
-- The user's organizationId is showing as truncated in the frontend

-- 1. Check the current user's organization_id in the database
SELECT 
    id,
    email,
    name,
    role,
    organization_id,
    LENGTH(organization_id::text) as org_id_length
FROM public.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d';

-- 2. Check if there are any organizations in the database
SELECT 
    id,
    name,
    LENGTH(id::text) as org_id_length
FROM public.organizations 
ORDER BY created_at;

-- 3. Update the user's organization_id to a proper UUID if it's corrupted
UPDATE public.users 
SET organization_id = (
    SELECT id FROM public.organizations 
    ORDER BY created_at 
    LIMIT 1
)
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d'
AND (organization_id IS NULL OR LENGTH(organization_id::text) < 36);

-- 4. Verify the fix
SELECT 
    id,
    email,
    name,
    role,
    organization_id,
    LENGTH(organization_id::text) as org_id_length
FROM public.users 
WHERE id = '69b388f9-2f6c-4312-8518-5a76cce5209d';
