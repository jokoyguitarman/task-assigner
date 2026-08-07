-- 0004_tighten_function_grants
--
-- Two things 0003 missed, both found by verify_rebuild.sql immediately after it
-- was applied.
--
-- 1. Every REVOKE ALL ... FROM PUBLIC in 0003 was ineffective against anon.
--
--    Supabase configures default privileges on schema public so that any
--    function created there is granted EXECUTE to anon, authenticated and
--    service_role explicitly. Revoking from PUBLIC removes the implicit grant
--    and leaves the explicit one, so after 0003 every function was still
--    callable with nothing but the publishable key. Verified from proacl:
--    `anon=X/postgres` on all of them.
--
--    custom_access_token_hook was the one exception, because that revoke names
--    anon directly. This file does the same for the rest.
--
--    It matters most for get_organization_limits and
--    get_organization_usage_stats: both are SECURITY DEFINER, both take an
--    organization id as an argument, and both were reachable unauthenticated.
--
-- 2. handle_user_update survived, attached to on_auth_user_updated on
--    auth.users. It is the last of the auth-sync machinery 0003 dismantled, it
--    does not pin search_path, and it reverts a profile name to whatever is in
--    auth metadata on every update of the auth row.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. anon executes nothing except the pre-auth invitation lookups
-- ---------------------------------------------------------------------------
--
-- authenticated keeps EXECUTE deliberately: the policy set calls app_org_id()
-- and friends, and a policy expression is evaluated as the querying role, so
-- revoking from authenticated would deny every table read.

-- Both revokes are needed and neither is sufficient alone. A function whose
-- proacl is null grants EXECUTE to PUBLIC implicitly, and anon reaches it that
-- way, so revoking from anon alone leaves it open. Once PUBLIC is revoked the
-- acl is materialised and the explicit anon grant from default privileges
-- becomes visible, which is what the second revoke removes.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Policies call app_org_id() and app_is_admin(), and a policy expression runs
-- as the querying role, so authenticated must keep EXECUTE or every table read
-- fails. Trigger functions are included harmlessly: they raise if called
-- directly, and trigger firing does not check EXECUTE anyway.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Only the auth server may mint claims.
REVOKE ALL ON FUNCTION public.custom_access_token_hook(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;

-- Reading an invitation happens before there is a session, so these three stay.
-- They require an exact token and cannot be used to enumerate the table.
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT)       TO anon;
GRANT EXECUTE ON FUNCTION public.find_pending_invitation(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_invitation_used(TEXT)          TO anon;

-- So the next function added does not quietly become public again.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ---------------------------------------------------------------------------
-- 2. Tier limits answer only for the caller's own organization
-- ---------------------------------------------------------------------------
--
-- These are SECURITY DEFINER and take an organization id, so without a check
-- any signed-in branch could read another tenant's headcount by passing its
-- uuid. A null claim set means the caller is service_role or a cron job, which
-- legitimately reports on any organization.

CREATE OR REPLACE FUNCTION public.get_organization_usage_stats(org_id UUID)
RETURNS TABLE (
    admins_used       INTEGER,
    admins_max        INTEGER,
    restaurants_used  INTEGER,
    restaurants_max   INTEGER,
    employees_used    INTEGER,
    employees_max     INTEGER,
    subscription_tier VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        (SELECT COUNT(*)::INTEGER FROM public.users u
            WHERE u.organization_id = org_id AND u.role = 'admin'),
        o.max_admins,
        (SELECT COUNT(*)::INTEGER FROM public.outlets ou
            WHERE ou.organization_id = org_id AND ou.is_active),
        o.max_restaurants,
        (SELECT COUNT(*)::INTEGER FROM public.staff_profiles sp
            WHERE sp.organization_id = org_id AND sp.is_active),
        o.max_employees,
        o.subscription_tier
    FROM public.organizations o
    WHERE o.id = org_id
      AND (public.app_org_id() IS NULL OR public.app_org_id() = org_id);
$$;

CREATE OR REPLACE FUNCTION public.get_organization_limits(org_id UUID)
RETURNS TABLE (
    max_admins          INTEGER,
    max_restaurants     INTEGER,
    max_employees       INTEGER,
    current_admins      BIGINT,
    current_restaurants BIGINT,
    current_employees   BIGINT,
    subscription_tier   VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        o.max_admins,
        o.max_restaurants,
        o.max_employees,
        (SELECT COUNT(*) FROM public.users u
            WHERE u.organization_id = org_id AND u.role = 'admin'),
        (SELECT COUNT(*) FROM public.outlets ou
            WHERE ou.organization_id = org_id AND ou.is_active),
        (SELECT COUNT(*) FROM public.staff_profiles sp
            WHERE sp.organization_id = org_id AND sp.is_active),
        o.subscription_tier
    FROM public.organizations o
    WHERE o.id = org_id
      AND (public.app_org_id() IS NULL OR public.app_org_id() = org_id);
$$;

-- CREATE OR REPLACE resets the ACL to the schema default, which is what put
-- anon on these in the first place. Revoke again after replacing them.
REVOKE ALL ON FUNCTION public.get_organization_usage_stats(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_organization_limits(UUID)      FROM anon;
GRANT EXECUTE ON FUNCTION public.get_organization_usage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_limits(UUID)      TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. The last auth-sync trigger
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_update() CASCADE;

COMMIT;
