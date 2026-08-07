-- 0002_hotfix_privilege_escalation
--
-- Closes the two exploitable holes verified on 2026-08-06 and removes the
-- email-substring admin rule. Deliberately small: no data migration, no change
-- to how anyone currently logs in, and nothing here depends on the auth rework
-- in 0003 and 0004.
--
-- Requires one client change, in src/services/supabaseService.ts:
-- invitationsAPI.getByToken and invitationsAPI.markAsUsed must call the RPCs
-- defined below instead of querying the invitations table directly. Apply the
-- client change and this migration together.
--
-- NOT fixed here, because both need the organization bootstrap RPC in 0003:
--   * anon may still INSERT into users and organizations
--   * RestaurantSignup still supplies its own subscription_tier and limits

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Stop users from promoting themselves
-- ---------------------------------------------------------------------------
--
-- The "Users can update their own profile" policy restricts which row you may
-- update and cannot restrict which columns, so role and organization_id were
-- writable by their owner. Column privileges are the missing half: RLS picks the
-- row, GRANT picks the columns.
--
-- The withheld columns are id, email, role, organization_id and is_primary_admin.
-- email matters as much as role here, because the invitation policies match on
-- users.email, so a user who could rewrite their own address could claim any
-- invitation.
--
-- usersAPI.update in supabaseService.ts sends email, name and role. It has no
-- callers, and RLS already prevented it from touching anyone else's row, so
-- nothing legitimate loses access. Streak writes keep working.

REVOKE UPDATE ON public.users FROM anon, authenticated;

GRANT UPDATE (
    name,
    current_streak,
    longest_streak,
    last_clear_board_date,
    updated_at
) ON public.users TO authenticated;

-- handle_user_update is SECURITY DEFINER and runs as the owner, so the auth ->
-- profile email sync is unaffected by the revoke above.

-- ---------------------------------------------------------------------------
-- 2. Stop the invitations table being world-readable
-- ---------------------------------------------------------------------------
--
-- Two policies granted FOR SELECT USING (true) to the public role, which
-- includes anon, so the anon key shipped in the client bundle could list every
-- organization's invitation tokens. The requirement they were serving is real:
-- SignupForm must read an invitation before the invitee has an account.
--
-- A SECURITY DEFINER function serves that requirement without the table being
-- readable, because it demands the exact token rather than allowing a scan.

DROP POLICY IF EXISTS "Allow public read invitations by token" ON public.invitations;
DROP POLICY IF EXISTS "Public read invitations for signup"     ON public.invitations;

-- These two matched on users.email, which is now immutable to its owner, but
-- they are redundant once lookups go through the RPC.
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON public.invitations;
DROP POLICY IF EXISTS "Users can update their own invitations"  ON public.invitations;

-- Returns the fields SignupForm reads. Deliberately omits created_by and the
-- joined creator profile, which the form never used. used_at and expires_at are
-- returned rather than filtered on so the form can keep distinguishing "already
-- used" from "expired" in its error messages.

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT,
    outlet_id UUID,
    organization_id UUID,
    token TEXT,
    -- Naive TIMESTAMP, not TIMESTAMPTZ: these must match the live column types
    -- exactly or Postgres rejects the function. 0003 converts the columns to
    -- timestamptz and redeclares these to match.
    expires_at TIMESTAMP,
    used_at TIMESTAMP,
    outlet_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT i.id, i.email, i.role, i.outlet_id, i.organization_id,
           i.token, i.expires_at, i.used_at, o.name
    FROM public.invitations i
    LEFT JOIN public.outlets o ON o.id = i.outlet_id
    WHERE i.token = p_token;
$$;

-- StaffOutletAuth's self-signup has no token: the invitee types their email and
-- role, and the component called invitationsAPI.getAll() and filtered in the
-- browser, which only worked because the whole table was public. This is the
-- narrowest replacement that keeps that screen working.
--
-- Residual exposure: someone who knows a colleague's email address and guesses
-- their role can retrieve that invitation's token. That is strictly better than
-- the current table dump but still weaker than a token-only link, and it is the
-- reason this screen should eventually require the emailed URL like SignupForm
-- does. Tracked as part of the auth rework.

CREATE OR REPLACE FUNCTION public.find_pending_invitation(p_email TEXT, p_role TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT,
    outlet_id UUID,
    organization_id UUID,
    token TEXT,
    expires_at TIMESTAMP
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT i.id, i.email, i.role, i.outlet_id, i.organization_id, i.token, i.expires_at
    FROM public.invitations i
    WHERE lower(i.email) = lower(p_email)
      AND i.role = p_role
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
    ORDER BY i.created_at DESC
    LIMIT 1;
$$;

-- Redeeming is also pre-auth, and single-use is now enforced by the WHERE clause
-- rather than by the client checking used_at and hoping.

CREATE OR REPLACE FUNCTION public.mark_invitation_used(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    affected INTEGER;
BEGIN
    UPDATE public.invitations
    SET used_at = NOW(), updated_at = NOW()
    WHERE token = p_token
      AND used_at IS NULL
      AND expires_at > NOW();

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(TEXT)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_pending_invitation(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_invitation_used(TEXT)          FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_pending_invitation(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invitation_used(TEXT)          TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Stop granting admin by email substring
-- ---------------------------------------------------------------------------
--
-- The previous body contained:
--
--     WHEN NEW.email LIKE '%admin%'   THEN 'admin'
--     WHEN NEW.email LIKE '%manager%' THEN 'admin'
--
-- on an address the signing-up user chooses. Everyone now starts as staff, and
-- promotion happens only through the bootstrap path added in 0003.
--
-- ON CONFLICT DO NOTHING because several client signup paths also insert their
-- own profile row. This makes the trigger idempotent rather than a source of
-- duplicate-key failures. It does not by itself repair RestaurantSignup, which
-- inserts a second row after the trigger has already created one; that is fixed
-- in 0003 when organization creation moves server-side.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    'staff',
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Pin search_path on the identity helpers
-- ---------------------------------------------------------------------------
--
-- All are SECURITY DEFINER with a mutable search_path, which the Supabase linter
-- flags because a caller who can create objects in an earlier schema can shadow
-- the tables these read. 0004 replaces them with JWT claim reads; until then,
-- pin the path. Bodies are unchanged.

ALTER FUNCTION public.current_user_organization_id()          SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()                              SET search_path = public, pg_temp;
ALTER FUNCTION public.is_staff_user()                         SET search_path = public, pg_temp;
ALTER FUNCTION public.is_outlet_user()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.user_belongs_to_organization(UUID)      SET search_path = public, pg_temp;
ALTER FUNCTION public.get_organization_limits(UUID)           SET search_path = public, pg_temp;
ALTER FUNCTION public.get_organization_usage_stats(UUID)      SET search_path = public, pg_temp;
ALTER FUNCTION public.can_add_admin(UUID)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.can_add_restaurant(UUID)                SET search_path = public, pg_temp;
ALTER FUNCTION public.can_add_employee(UUID)                  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_user_update()                    SET search_path = public, pg_temp;

-- Trigger functions have no business being callable as RPCs.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_update()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_auth_user_for_staff()      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_auth_user_for_staff()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_auth_user_for_outlet()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_existing_staff_to_auth(record)  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_existing_outlet_to_auth(record) FROM anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
--
-- As a signed-in non-admin, this must now fail with a permission error on
-- column "role" rather than succeeding:
--
--     UPDATE users SET role = 'admin' WHERE id = auth.uid();
--
-- With the anon key and no session, this must return zero rows:
--
--     SELECT * FROM invitations;
--
-- and this must still return the one matching invitation:
--
--     SELECT * FROM get_invitation_by_token('<a real token>');
