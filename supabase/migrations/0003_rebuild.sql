-- 0003_rebuild
--
-- Single transactional rewrite of the schema, in place, against the two-principal
-- model confirmed with the owner on 2026-08-06:
--
--     The OWNER (role 'admin') signs in and sees their whole organization.
--     A BRANCH (role 'outlet') signs in on the shared store phone and sees itself.
--     STAFF DO NOT SIGN IN. They are roster entries that own and complete tasks.
--
-- Postgres DDL is transactional. Every statement below is inside one BEGIN/COMMIT,
-- so either the whole rebuild lands or the database is untouched. Take a backup
-- anyway; the transaction protects against a failed statement, not against a
-- successful statement you did not want.
--
-- This file supersedes 0002 and is safe to run whether or not 0002 was applied.
--
-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN THIS
-- ---------------------------------------------------------------------------
--
-- 1. Back up the database.
--
-- 2. This migration converts every naive `timestamp` column to `timestamptz`,
--    interpreting the stored values as UTC. That is correct for this database:
--    `SHOW TimeZone` returns UTC, so server-side NOW() wrote UTC wall clock, and
--    the client wrote `new Date().toISOString()`, which is also UTC. Verified:
--    no row has a created_at or completed_at in the future.
--
-- 3. Set the organization timezone in section 11 if the business is not in
--    Asia/Manila. It drives the digest schedule and the definition of "today".
--
-- ---------------------------------------------------------------------------
-- AFTER YOU RUN THIS
-- ---------------------------------------------------------------------------
--
-- 1. Register the access token hook: Dashboard > Authentication > Hooks >
--    Customize Access Token, and select `public.custom_access_token_hook`.
--    NOTHING WORKS UNTIL YOU DO THIS. Every policy reads claims that only the
--    hook can mint, so until it is registered every signed-in user sees nothing.
--
-- 2. Everyone must sign out and sign back in. Existing tokens predate the hook
--    and carry no claims.
--
-- 3. Client changes are required. See CLIENT_CHANGES in supabase/SCHEMA_NOTES.md.
--    In particular the "default to admin" fallback in authAPI.login must go: it
--    will now fail rather than silently granting admin, and it will surface as a
--    login error for any account with no profile row.
--
-- 4. Two of the four outlets have no login. Invite them from Outlet Management
--    and have them sign up through the link; `redeem_outlet_invitation` below
--    does the provisioning. No Edge Function and no auth admin API is needed for
--    this. The old triggers that wrote directly into auth.users are dropped here
--    precisely because that approach is unsupported and was corrupting accounts.

BEGIN;

-- ===========================================================================
-- 0. PREFLIGHT
-- ===========================================================================
--
-- Refuse to run against a database that is not in the state this migration was
-- written for. Cheaper to fail here than to discover a bad assumption halfway
-- through a rewrite.

DO $$
DECLARE
    v_real_admins        INTEGER;
    v_orgs               INTEGER;
    v_orphan_assignments INTEGER;
    v_future_ts          INTEGER;
BEGIN
    -- There must be at least one admin with a real auth account, because the
    -- ghost primary admin is deleted below and its flag transferred to a live one.
    SELECT COUNT(*) INTO v_real_admins
    FROM public.users u
    WHERE u.role = 'admin' AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

    IF v_real_admins = 0 THEN
        RAISE EXCEPTION
            'Preflight failed: no admin has an auth account. Create one before rebuilding, '
            'or this migration will leave the organization with no owner.';
    END IF;

    -- Every assignment must carry an outlet, because outlet_id is what the new
    -- policy set scopes branch access by.
    SELECT COUNT(*) INTO v_orphan_assignments
    FROM public.task_assignments WHERE outlet_id IS NULL;

    IF v_orphan_assignments > 0 THEN
        RAISE EXCEPTION
            'Preflight failed: % task_assignments have no outlet_id. The branch policy '
            'scopes on outlet_id, so these rows would become invisible.', v_orphan_assignments;
    END IF;

    -- The timestamp conversion assumes stored values are UTC.
    SELECT COUNT(*) INTO v_future_ts
    FROM public.task_assignments
    WHERE created_at > NOW()::timestamp OR completed_at > NOW()::timestamp;

    IF v_future_ts > 0 THEN
        RAISE EXCEPTION
            'Preflight failed: % rows have timestamps in the future, so they were probably '
            'not written as UTC. Re-check the AT TIME ZONE conversion in section 12.', v_future_ts;
    END IF;

    SELECT COUNT(*) INTO v_orgs FROM public.organizations;
    IF v_orgs <> 1 THEN
        RAISE WARNING
            'Expected exactly 1 organization, found %. The migration still works, but the '
            'timezone backfill in section 11 sets every organization to the same value.', v_orgs;
    END IF;
END $$;

-- ===========================================================================
-- 1. DROP EVERY EXISTING POLICY
-- ===========================================================================
--
-- All 35 of them. They accumulated across ~54 separate attempts, they overlap,
-- and because Postgres ORs permissive policies the weakest one always won.
-- Section 19 replaces them with a set small enough to hold in your head.

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ===========================================================================
-- 2. DROP THE OBSOLETE TRIGGERS AND FUNCTIONS
-- ===========================================================================
--
-- The staff credential triggers wrote rows straight into auth.users with
-- hand-rolled crypt() hashing. Their combination was destructive: cleanup fired
-- BEFORE every UPDATE and deleted the auth user, create fired AFTER and only
-- restored it when a password was present, which none are. They exist to give
-- staff logins, and staff do not get logins.

DROP TRIGGER IF EXISTS trigger_create_auth_user_for_staff  ON public.staff_profiles;
DROP TRIGGER IF EXISTS trigger_cleanup_auth_user_for_staff ON public.staff_profiles;

DROP FUNCTION IF EXISTS public.create_auth_user_for_staff()      CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_auth_user_for_staff()     CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_auth_user_for_outlet()    CASCADE;
DROP FUNCTION IF EXISTS public.sync_existing_staff_to_auth(record)  CASCADE;
DROP FUNCTION IF EXISTS public.sync_existing_outlet_to_auth(record) CASCADE;

-- Profile creation becomes explicit: bootstrap_organization for owners, an Edge
-- Function for branch logins. A signup with no provisioning now produces an auth
-- user with no profile, which the new policies deny by default. That is the
-- correct failure mode; the previous trigger granted admin on an email substring.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- These read public.users to answer questions the JWT will now answer directly.
-- They are what forced SECURITY DEFINER everywhere to escape policy recursion.

DROP FUNCTION IF EXISTS public.is_admin()                          CASCADE;
DROP FUNCTION IF EXISTS public.is_staff_user()                     CASCADE;
DROP FUNCTION IF EXISTS public.is_outlet_user()                    CASCADE;
DROP FUNCTION IF EXISTS public.current_user_organization_id()      CASCADE;
DROP FUNCTION IF EXISTS public.user_belongs_to_organization(uuid)  CASCADE;

-- ===========================================================================
-- 3. DROP THE UNUSED TABLE
-- ===========================================================================
--
-- Empty, no policies, and nothing in the application reads or writes it. The
-- concept it was reaching for (minutes worked versus minutes deducted) is better
-- served by querying assignments.

DROP TABLE IF EXISTS public.staff_working_hours;

-- ===========================================================================
-- 4. STAFF PROFILES BECOME THE ROSTER
-- ===========================================================================
--
-- A staff member's name currently lives in public.users, reached through
-- staff_profiles.user_id, which is why ten non-principals sit in the principals
-- table inflating the employee count. The name moves here and those rows go.
--
-- outlet_id is new: staff belong to a branch. Backfilled best-effort from the
-- outlet they were most often scheduled at, and left null where that is unknown.

ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS last_clear_board_date DATE;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.staff_profiles sp
SET name           = COALESCE(NULLIF(TRIM(u.name), ''), 'Unnamed staff'),
    current_streak = COALESCE(u.current_streak, 0),
    longest_streak = COALESCE(u.longest_streak, 0),
    last_clear_board_date = u.last_clear_board_date
FROM public.users u
WHERE u.id = sp.user_id;

UPDATE public.staff_profiles SET name = 'Unnamed staff' WHERE name IS NULL OR TRIM(name) = '';

-- Most frequently scheduled outlet wins. Only fills rows that have one.
WITH ranked AS (
    SELECT m.staff_id,
           d.outlet_id,
           ROW_NUMBER() OVER (PARTITION BY m.staff_id ORDER BY COUNT(*) DESC, d.outlet_id) AS rn
    FROM public.daily_schedules d
    JOIN public.monthly_schedules m ON m.id = d.monthly_schedule_id
    WHERE d.outlet_id IS NOT NULL
    GROUP BY m.staff_id, d.outlet_id
)
UPDATE public.staff_profiles sp
SET outlet_id = r.outlet_id
FROM ranked r
WHERE r.staff_id = sp.id AND r.rn = 1 AND sp.outlet_id IS NULL;

ALTER TABLE public.staff_profiles ALTER COLUMN name SET NOT NULL;

-- The credential columns have no purpose now. No migration needed: no staff row
-- stores a password, and staff do not authenticate.
ALTER TABLE public.staff_profiles DROP COLUMN IF EXISTS username;
ALTER TABLE public.staff_profiles DROP COLUMN IF EXISTS password;

-- Severs the roster from the principals table. Verified beforehand that nothing
-- else references the staff user rows.
ALTER TABLE public.staff_profiles DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.staff_profiles ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_profiles_outlet_id ON public.staff_profiles(outlet_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_active    ON public.staff_profiles(organization_id) WHERE is_active;

-- ===========================================================================
-- 5. USERS BECOMES PRINCIPALS ONLY
-- ===========================================================================

-- The ten role='staff' rows are now unreferenced. They never had logins and
-- never should have.
DELETE FROM public.users WHERE role = 'staff';

-- One admin row is flagged is_primary_admin but has no auth account, so nobody
-- can sign in as the designated owner. Move the flag to a real account, then
-- delete the ghost.
UPDATE public.users
SET is_primary_admin = TRUE
WHERE id = (
    SELECT u.id FROM public.users u
    WHERE u.role = 'admin' AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id)
    ORDER BY u.created_at
    LIMIT 1
);

DELETE FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

-- A profile is now strictly the application-side half of an auth account.
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_id_fkey') THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Only two kinds of principal exist. Encoding that in the constraint means a
-- future bug cannot quietly reintroduce a third.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD  CONSTRAINT users_role_check CHECK (role IN ('admin', 'outlet'));

ALTER TABLE public.users ALTER COLUMN organization_id SET NOT NULL;

-- Streaks belong to roster members, not principals.
ALTER TABLE public.users DROP COLUMN IF EXISTS current_streak;
ALTER TABLE public.users DROP COLUMN IF EXISTS longest_streak;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_clear_board_date;

DROP INDEX IF EXISTS public.idx_users_streak;
DROP INDEX IF EXISTS public.idx_users_last_clear;

-- Exactly one owner per organization.
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_admin_per_org
    ON public.users(organization_id) WHERE is_primary_admin;

-- ===========================================================================
-- 6. OUTLETS
-- ===========================================================================
--
-- outlets.user_id is the link from a branch to its login, and it is what the
-- access token hook resolves outlet_id from. It must be one-to-one.

ALTER TABLE public.outlets DROP COLUMN IF EXISTS username;
ALTER TABLE public.outlets DROP COLUMN IF EXISTS password;
DROP INDEX IF EXISTS public.idx_outlets_username;
DROP INDEX IF EXISTS public.unique_outlet_username;

ALTER TABLE public.outlets ALTER COLUMN organization_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_outlet_user_id
    ON public.outlets(user_id) WHERE user_id IS NOT NULL;

-- ===========================================================================
-- 7. STAFF POSITIONS BECOME TENANT AWARE
-- ===========================================================================
--
-- The table had no organization_id, so one tenant's custom position was visible
-- to all. A null organization_id means a built-in position shared by everyone;
-- the seven seeded rows keep it.

ALTER TABLE public.staff_positions
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_staff_positions_organization_id ON public.staff_positions(organization_id);

-- ===========================================================================
-- 8. TASKS
-- ===========================================================================
--
-- ishighpriority and is_high_priority were two independent columns for one
-- concept, disagreeing on three of five rows. Either being true means the owner
-- marked it urgent at some point, so OR is the safe collapse.

UPDATE public.tasks SET is_high_priority = (is_high_priority OR ishighpriority);

DROP INDEX IF EXISTS public.idx_tasks_priority;
DROP INDEX IF EXISTS public.idx_tasks_high_priority;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS ishighpriority;

ALTER TABLE public.tasks ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_high_priority ON public.tasks(organization_id) WHERE is_high_priority;
CREATE INDEX IF NOT EXISTS idx_tasks_recurring     ON public.tasks(organization_id) WHERE is_recurring;

-- ===========================================================================
-- 9. TASK ASSIGNMENTS
-- ===========================================================================
--
-- completion_notes is new. TaskCompletion.tsx has always collected notes and
-- then dropped them on the floor because there was nowhere to put them.
--
-- completed_by_staff_id is new and matters more than it looks. The store phone
-- is shared, so whoever completes a task picks a name from the roster. That is
-- a different fact from who the task was assigned to, and conflating them makes
-- reassignment history unreadable.

ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE public.task_assignments
    ADD COLUMN IF NOT EXISTS completed_by_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL;

UPDATE public.task_assignments
SET completed_by_staff_id = staff_id
WHERE status = 'completed' AND completed_by_staff_id IS NULL AND staff_id IS NOT NULL;

-- Task deletion should take its assignments with it rather than erroring.
ALTER TABLE public.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_task_id_fkey;
ALTER TABLE public.task_assignments
    ADD CONSTRAINT task_assignments_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_assignments ALTER COLUMN outlet_id SET NOT NULL;

-- Every dashboard filters on at least one of these and none were indexed.
CREATE INDEX IF NOT EXISTS idx_assignments_outlet_due   ON public.task_assignments(outlet_id, due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_staff        ON public.task_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_assignments_task         ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_org_status   ON public.task_assignments(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_open_due     ON public.task_assignments(due_date)
    WHERE status IN ('pending', 'overdue');

-- ===========================================================================
-- 10. DEDUPLICATE AND REPAIR THE SCHEDULES
-- ===========================================================================
--
-- MonthlyScheduler writes row by row with no transaction and no unique
-- constraint to write against, and it shows: 41 of 57 monthly rows are surplus
-- duplicates, and 24 of 174 daily rows are too. Three daily duplicate groups
-- disagree about the actual shift.
--
-- All of this data is a two-week window from Aug-Sep 2025 with nothing in the
-- future, so the dedup rule matters little in practice. Newest row wins, which
-- is what the scheduler's last write intended.

-- Move children onto the surviving parent before deleting duplicate parents.
WITH survivors AS (
    SELECT id,
           FIRST_VALUE(id) OVER (
               PARTITION BY staff_id, month, year
               ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS keep_id
    FROM public.monthly_schedules
)
UPDATE public.daily_schedules d
SET monthly_schedule_id = s.keep_id
FROM survivors s
WHERE d.monthly_schedule_id = s.id AND s.id <> s.keep_id;

WITH survivors AS (
    SELECT id,
           FIRST_VALUE(id) OVER (
               PARTITION BY staff_id, month, year
               ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS keep_id
    FROM public.monthly_schedules
)
DELETE FROM public.monthly_schedules m
USING survivors s
WHERE m.id = s.id AND s.id <> s.keep_id;

-- Now collapse same-day duplicates, including any newly collided by the merge.
WITH survivors AS (
    SELECT id,
           FIRST_VALUE(id) OVER (
               PARTITION BY monthly_schedule_id, schedule_date
               ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS keep_id
    FROM public.daily_schedules
)
DELETE FROM public.daily_schedules d
USING survivors s
WHERE d.id = s.id AND s.id <> s.keep_id;

-- 41 daily rows carry no organization_id, which makes them invisible to every
-- org-scoped policy. The parent always knows.
UPDATE public.daily_schedules d
SET organization_id = m.organization_id
FROM public.monthly_schedules m
WHERE m.id = d.monthly_schedule_id AND d.organization_id IS NULL;

DELETE FROM public.daily_schedules WHERE organization_id IS NULL;

ALTER TABLE public.monthly_schedules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.monthly_schedules ALTER COLUMN staff_id        SET NOT NULL;
ALTER TABLE public.daily_schedules   ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.daily_schedules   ALTER COLUMN monthly_schedule_id SET NOT NULL;

-- The constraints that would have prevented all of the above.
ALTER TABLE public.monthly_schedules DROP CONSTRAINT IF EXISTS unique_staff_month_year;
ALTER TABLE public.monthly_schedules
    ADD CONSTRAINT unique_staff_month_year UNIQUE (staff_id, month, year);

ALTER TABLE public.daily_schedules DROP CONSTRAINT IF EXISTS unique_schedule_day;
ALTER TABLE public.daily_schedules
    ADD CONSTRAINT unique_schedule_day UNIQUE (monthly_schedule_id, schedule_date);

ALTER TABLE public.daily_schedules DROP CONSTRAINT IF EXISTS daily_schedules_monthly_schedule_id_fkey;
ALTER TABLE public.daily_schedules
    ADD CONSTRAINT daily_schedules_monthly_schedule_id_fkey
    FOREIGN KEY (monthly_schedule_id) REFERENCES public.monthly_schedules(id) ON DELETE CASCADE;

ALTER TABLE public.monthly_schedules DROP CONSTRAINT IF EXISTS monthly_schedules_staff_id_fkey;
ALTER TABLE public.monthly_schedules
    ADD CONSTRAINT monthly_schedules_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.staff_profiles(id) ON DELETE CASCADE;

-- A day off cannot also be a shift. This is the constraint the scheduler UI
-- assumes and the database never enforced. Empty-string day_off_type is
-- normalised away first because the form submits '' for working days.
UPDATE public.daily_schedules SET day_off_type = NULL WHERE day_off_type = '';
UPDATE public.daily_schedules
SET outlet_id = NULL, time_in = NULL, time_out = NULL
WHERE is_day_off;

ALTER TABLE public.daily_schedules ALTER COLUMN is_day_off SET NOT NULL;
ALTER TABLE public.daily_schedules ALTER COLUMN is_day_off SET DEFAULT FALSE;

ALTER TABLE public.daily_schedules DROP CONSTRAINT IF EXISTS daily_schedules_shift_check;
ALTER TABLE public.daily_schedules
    ADD CONSTRAINT daily_schedules_shift_check CHECK (
        (is_day_off AND outlet_id IS NULL AND time_in IS NULL AND time_out IS NULL)
        OR
        (NOT is_day_off AND outlet_id IS NOT NULL AND day_off_type IS NULL)
    );

-- ===========================================================================
-- 11. ORGANIZATION TIMEZONE
-- ===========================================================================
--
-- "Was the garbage taken out today?" needs a definition of today, and a
-- restaurant's day ends after midnight. Storing it per organization is what lets
-- the overdue sweep and the digest run at the right local hour rather than at
-- UTC midnight, which is mid-afternoon in Manila.
--
-- CHANGE THE DEFAULT BELOW IF THE BUSINESS IS NOT IN THE PHILIPPINES.

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Manila';

ALTER TABLE public.organizations ALTER COLUMN subscription_tier   SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN subscription_status SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN max_admins      SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN max_restaurants SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN max_employees   SET NOT NULL;

-- ===========================================================================
-- 12. TIMESTAMPS BECOME TIMEZONE AWARE
-- ===========================================================================
--
-- Every naive timestamp in the schema, converted as UTC. See the note at the top
-- of this file for why UTC is the right interpretation here.
--
-- Date columns are deliberately left alone: assigned_date, due_date and
-- schedule_date are business dates in the organization's local timezone, not
-- instants, and column 11 is what resolves them.

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.data_type = 'timestamp without time zone'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name, c.column_name
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
            r.table_name, r.column_name, r.column_name
        );
    END LOOP;
END $$;

-- One shared trigger replaces the client remembering to send updated_at, which
-- it did inconsistently.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'updated_at'
          AND t.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.%I', r.table_name);
        EXECUTE format(
            'CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', r.table_name
        );
    END LOOP;
END $$;

-- ===========================================================================
-- 13. AUDIT LOG
-- ===========================================================================
--
-- Every server-side operation writes here. This is the record that makes an
-- agent that can reassign work and offboard people acceptable to run: when the
-- chat says it moved a task, there is a row proving what it actually did.

CREATE TABLE IF NOT EXISTS public.agent_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_role      TEXT,
    source          TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'chat', 'cron')),
    operation       TEXT NOT NULL,
    arguments       JSONB,
    result          JSONB,
    succeeded       BOOLEAN NOT NULL DEFAULT TRUE,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_org_time ON public.agent_actions(organization_id, created_at DESC);

-- ===========================================================================
-- 14. JWT CLAIMS
-- ===========================================================================
--
-- This is the change that makes the policy set simple. Previously every policy
-- asked the users table who you were, which recursed when the policy was itself
-- on users, which is what SECURITY DEFINER helpers were papering over. Now the
-- token carries the answer and policies do no table lookups at all.
--
-- Trade-off worth knowing: claims are stamped when the token is issued, so
-- moving a branch to another organization does not take effect until that
-- session refreshes. At an hour's token lifetime that is acceptable; if it ever
-- is not, force a sign-out on the change.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role   TEXT;
    v_org    UUID;
    v_outlet UUID;
    v_claims JSONB;
BEGIN
    SELECT u.role, u.organization_id
    INTO v_role, v_org
    FROM public.users u
    WHERE u.id = (event->>'user_id')::uuid;

    IF v_role = 'outlet' THEN
        SELECT o.id INTO v_outlet
        FROM public.outlets o
        WHERE o.user_id = (event->>'user_id')::uuid
        LIMIT 1;
    END IF;

    v_claims := event->'claims';

    -- Absent rather than null when unknown, so a principal with no profile gets
    -- no claims at all and every policy denies them.
    IF v_role IS NOT NULL THEN
        v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role));
    END IF;
    IF v_org IS NOT NULL THEN
        v_claims := jsonb_set(v_claims, '{organization_id}', to_jsonb(v_org::text));
    END IF;
    IF v_outlet IS NOT NULL THEN
        v_claims := jsonb_set(v_claims, '{outlet_id}', to_jsonb(v_outlet::text));
    END IF;

    RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- Only the auth server may run the hook, and it needs to read the two tables
-- the hook consults. These grants and policies are required by Supabase's hook
-- mechanism; without them token issuance fails and nobody can log in.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) FROM authenticated, anon, public;
GRANT SELECT ON public.users   TO supabase_auth_admin;
GRANT SELECT ON public.outlets TO supabase_auth_admin;

-- Claim readers. No table access, so no recursion is possible.

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT COALESCE(auth.jwt() ->> 'user_role', '') $$;

CREATE OR REPLACE FUNCTION public.app_org_id()
RETURNS UUID LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(auth.jwt() ->> 'organization_id', '')::uuid $$;

CREATE OR REPLACE FUNCTION public.app_outlet_id()
RETURNS UUID LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(auth.jwt() ->> 'outlet_id', '')::uuid $$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT public.app_role() = 'admin' AND public.app_org_id() IS NOT NULL $$;

CREATE OR REPLACE FUNCTION public.app_is_outlet()
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT public.app_role() = 'outlet' AND public.app_outlet_id() IS NOT NULL $$;

-- ===========================================================================
-- 15. TIER LIMIT FUNCTIONS
-- ===========================================================================
--
-- Both counted every user in the organization as an employee, so the owner and
-- the branch logins consumed employee slots meant for staff. Employees now come
-- from the roster, which is what the number was always supposed to mean.
--
-- DROP before CREATE because the return type changes, which CREATE OR REPLACE
-- cannot do.

DROP FUNCTION IF EXISTS public.get_organization_limits(UUID);
DROP FUNCTION IF EXISTS public.get_organization_usage_stats(UUID);
DROP FUNCTION IF EXISTS public.can_add_admin(UUID);
DROP FUNCTION IF EXISTS public.can_add_restaurant(UUID);
DROP FUNCTION IF EXISTS public.can_add_employee(UUID);

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
    WHERE o.id = org_id;
$$;

-- Kept with the same names and shapes that src/services/tierLimitsService.ts
-- already calls, so the corrected counts arrive without a client change.
-- get_organization_limits now also returns subscription_tier, which the
-- TierLimits interface has always declared and never received.

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
    WHERE o.id = org_id;
$$;

CREATE OR REPLACE FUNCTION public.can_add_admin(org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT current_admins < max_admins FROM public.get_organization_limits(org_id) $$;

CREATE OR REPLACE FUNCTION public.can_add_restaurant(org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT current_restaurants < max_restaurants FROM public.get_organization_limits(org_id) $$;

CREATE OR REPLACE FUNCTION public.can_add_employee(org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT current_employees < max_employees FROM public.get_organization_limits(org_id) $$;

-- Previously all of these were executable by anon against any organization id,
-- which leaked tenant headcount to anyone with the public key.
REVOKE ALL ON FUNCTION public.get_organization_usage_stats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organization_limits(UUID)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_add_admin(UUID)                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_add_restaurant(UUID)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_add_employee(UUID)             FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_usage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_limits(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_admin(UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_restaurant(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_employee(UUID)             TO authenticated;

-- ===========================================================================
-- 16. INVITATION LOOKUPS
-- ===========================================================================
--
-- Repeated from 0002 so this file stands alone. The invitations table is not
-- readable before signing in; these are the only pre-auth entry points, and they
-- require an exact token rather than allowing the table to be scanned.
--
-- Invitations now only ever provision branch logins, since staff do not sign up.

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID, email TEXT, role TEXT, outlet_id UUID, organization_id UUID,
    token TEXT, expires_at TIMESTAMPTZ, used_at TIMESTAMPTZ, outlet_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT i.id, i.email, i.role, i.outlet_id, i.organization_id,
           i.token, i.expires_at, i.used_at, o.name
    FROM public.invitations i
    LEFT JOIN public.outlets o ON o.id = i.outlet_id
    WHERE i.token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.find_pending_invitation(p_email TEXT, p_role TEXT)
RETURNS TABLE (
    id UUID, email TEXT, role TEXT, outlet_id UUID, organization_id UUID,
    token TEXT, expires_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.mark_invitation_used(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE affected INTEGER;
BEGIN
    UPDATE public.invitations
    SET used_at = NOW()
    WHERE token = p_token AND used_at IS NULL AND expires_at > NOW();
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

-- Invitations were being created without an organization_id, which made them
-- invisible to org-scoped reads. Backfill from the creator, then require it.
UPDATE public.invitations i
SET organization_id = u.organization_id
FROM public.users u
WHERE u.id = i.created_by AND i.organization_id IS NULL;

DELETE FROM public.invitations WHERE organization_id IS NULL;
ALTER TABLE public.invitations ALTER COLUMN organization_id SET NOT NULL;

-- ===========================================================================
-- 17. ORGANIZATION BOOTSTRAP
-- ===========================================================================
--
-- Replaces RestaurantSignup creating an organization from the browser with
-- client-supplied tier limits. It also fixes that flow, which currently collides
-- with the signup trigger and fails.
--
-- Callable once per account: the caller must be signed in and must not already
-- have a profile. Tier limits are set here, not accepted from the client.

CREATE OR REPLACE FUNCTION public.bootstrap_organization(
    p_organization_name TEXT,
    p_admin_name        TEXT,
    p_timezone          TEXT DEFAULT 'Asia/Manila'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_email TEXT;
    v_org   UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Must be signed in to create an organization';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid) THEN
        RAISE EXCEPTION 'This account already belongs to an organization';
    END IF;

    IF COALESCE(TRIM(p_organization_name), '') = '' THEN
        RAISE EXCEPTION 'Organization name is required';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    INSERT INTO public.organizations (name, timezone, subscription_tier, subscription_status,
                                      max_admins, max_restaurants, max_employees)
    VALUES (TRIM(p_organization_name), p_timezone, 'free', 'trial', 1, 1, 10)
    RETURNING id INTO v_org;

    INSERT INTO public.users (id, email, name, role, organization_id, is_primary_admin)
    VALUES (v_uid, v_email, COALESCE(NULLIF(TRIM(p_admin_name), ''), SPLIT_PART(v_email, '@', 1)),
            'admin', v_org, TRUE);

    INSERT INTO public.agent_actions (organization_id, actor_user_id, actor_role, source, operation, arguments)
    VALUES (v_org, v_uid, 'admin', 'app', 'bootstrap_organization',
            jsonb_build_object('organization_name', TRIM(p_organization_name), 'timezone', p_timezone));

    RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_organization(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_organization(TEXT, TEXT, TEXT) TO authenticated;

-- The other way a principal comes into existence. A branch is invited by the
-- owner, signs up with the emailed link, and redeems it here.
--
-- This is what keeps the existing invitation screens working now that clients
-- cannot insert into users. Without it the only route to a branch login would be
-- the auth admin API, and two of the four outlets already have no login.
--
-- The caller's own email must match the invitation, so holding a leaked token is
-- not by itself enough to claim a branch.

CREATE OR REPLACE FUNCTION public.redeem_outlet_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_email TEXT;
    v_inv   public.invitations%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Must be signed in to redeem an invitation';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid) THEN
        RAISE EXCEPTION 'This account is already set up';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    SELECT * INTO v_inv
    FROM public.invitations
    WHERE token = p_token
      AND role = 'outlet'
      AND used_at IS NULL
      AND expires_at > NOW()
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'That invitation is invalid, already used, or expired';
    END IF;

    IF lower(v_inv.email) <> lower(v_email) THEN
        RAISE EXCEPTION 'This invitation was issued to a different email address';
    END IF;

    IF v_inv.outlet_id IS NULL THEN
        RAISE EXCEPTION 'That invitation is not attached to a branch';
    END IF;

    IF EXISTS (SELECT 1 FROM public.outlets WHERE id = v_inv.outlet_id AND user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'That branch already has a login';
    END IF;

    INSERT INTO public.users (id, email, name, role, organization_id)
    SELECT v_uid, v_email, o.name, 'outlet', v_inv.organization_id
    FROM public.outlets o WHERE o.id = v_inv.outlet_id;

    UPDATE public.outlets SET user_id = v_uid WHERE id = v_inv.outlet_id;
    UPDATE public.invitations SET used_at = NOW() WHERE id = v_inv.id;

    INSERT INTO public.agent_actions (organization_id, actor_user_id, actor_role, source, operation, arguments)
    VALUES (v_inv.organization_id, v_uid, 'outlet', 'app', 'redeem_outlet_invitation',
            jsonb_build_object('outlet_id', v_inv.outlet_id, 'invitation_id', v_inv.id));

    RETURN v_inv.outlet_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_outlet_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_outlet_invitation(TEXT) TO authenticated;

-- ===========================================================================
-- 18. TABLE GRANTS
-- ===========================================================================
--
-- Supabase grants every role full table access by default and relies entirely on
-- RLS. Defence in depth is cheap here: anon has no legitimate table access at
-- all now that pre-auth reads go through SECURITY DEFINER functions, so take it
-- away rather than trusting one policy set to be flawless. This also clears the
-- linter's "visible in the GraphQL schema to anon" findings.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Column privileges are the half RLS cannot do: a policy chooses the row, a
-- grant chooses the columns. Without this, "update your own profile" means
-- "set your own role to admin".
REVOKE UPDATE ON public.users FROM authenticated;
GRANT  UPDATE (name) ON public.users TO authenticated;

-- Principals are created by bootstrap_organization and by the outlet
-- provisioning Edge Function, both of which run with elevated rights.
REVOKE INSERT, DELETE ON public.users         FROM authenticated;
REVOKE INSERT, DELETE ON public.organizations FROM authenticated;

-- ===========================================================================
-- 19. THE POLICY SET
-- ===========================================================================
--
-- Two principals, so roughly two policies per table. Read this as: an owner sees
-- their organization, a branch sees itself.
--
-- Every policy targets `authenticated` explicitly. None targets `public`, which
-- is what let anon match policies in the old set. service_role bypasses RLS
-- entirely, which is how Edge Functions and cron jobs do their work.

ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions          ENABLE ROW LEVEL SECURITY;

-- The access token hook runs as supabase_auth_admin and must read these two
-- tables to mint claims at all.
CREATE POLICY auth_admin_read_users ON public.users
    FOR SELECT TO supabase_auth_admin USING (true);
CREATE POLICY auth_admin_read_outlets ON public.outlets
    FOR SELECT TO supabase_auth_admin USING (true);

-- organizations
CREATE POLICY org_read ON public.organizations
    FOR SELECT TO authenticated
    USING (id = public.app_org_id());

CREATE POLICY org_admin_update ON public.organizations
    FOR UPDATE TO authenticated
    USING (id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (id = public.app_org_id() AND public.app_is_admin());

-- users. Column grants above are what stop a self-update from being a promotion.
CREATE POLICY users_read_own_org ON public.users
    FOR SELECT TO authenticated
    USING (organization_id = public.app_org_id());

CREATE POLICY users_update_self ON public.users
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- staff_positions: built-ins are shared, custom ones belong to one tenant.
CREATE POLICY positions_read ON public.staff_positions
    FOR SELECT TO authenticated
    USING (organization_id IS NULL OR organization_id = public.app_org_id());

CREATE POLICY positions_admin_write ON public.staff_positions
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

-- outlets: the owner manages all of them, a branch reads only itself.
CREATE POLICY outlets_admin_all ON public.outlets
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

CREATE POLICY outlets_branch_read_self ON public.outlets
    FOR SELECT TO authenticated
    USING (id = public.app_outlet_id());

-- staff_profiles: branches enrol their own people, which is how the owner
-- described it working. A branch cannot see another branch's roster.
CREATE POLICY staff_admin_all ON public.staff_profiles
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

CREATE POLICY staff_branch_read ON public.staff_profiles
    FOR SELECT TO authenticated
    USING (outlet_id = public.app_outlet_id());

CREATE POLICY staff_branch_enrol ON public.staff_profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.app_is_outlet()
                AND outlet_id = public.app_outlet_id()
                AND organization_id = public.app_org_id());

CREATE POLICY staff_branch_update ON public.staff_profiles
    FOR UPDATE TO authenticated
    USING (outlet_id = public.app_outlet_id() AND public.app_is_outlet())
    WITH CHECK (outlet_id = public.app_outlet_id() AND organization_id = public.app_org_id());

-- tasks: templates are organization-wide; a branch reads them to display work.
CREATE POLICY tasks_admin_all ON public.tasks
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

CREATE POLICY tasks_branch_read ON public.tasks
    FOR SELECT TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_outlet());

-- task_assignments. This replaces the USING (true) policy that exposed every
-- assignment in every tenant to any signed-in account. A branch may complete its
-- own work and request reschedules; it may not invent assignments for itself.
CREATE POLICY assignments_admin_all ON public.task_assignments
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

CREATE POLICY assignments_branch_read ON public.task_assignments
    FOR SELECT TO authenticated
    USING (outlet_id = public.app_outlet_id());

CREATE POLICY assignments_branch_update ON public.task_assignments
    FOR UPDATE TO authenticated
    USING (outlet_id = public.app_outlet_id() AND public.app_is_outlet())
    WITH CHECK (outlet_id = public.app_outlet_id());

-- The policy above lets a branch update its own assignment rows, and RLS cannot
-- narrow that to particular columns. Without this guard a branch could quietly
-- move its own due date, which defeats the entire point of the product: the
-- owner would see everything completed on time because the deadline moved.
--
-- A branch may record completion and ask for a reschedule. It may not change
-- what the work is, when it is due, or who owns it. Reschedules go through
-- status = 'reschedule_requested' and are approved by the owner.
--
-- app_is_outlet() is false for service_role and for the owner, so Edge
-- Functions and admin edits pass through untouched.

CREATE OR REPLACE FUNCTION public.guard_branch_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF public.app_is_outlet() THEN
        IF NEW.task_id            IS DISTINCT FROM OLD.task_id
        OR NEW.outlet_id          IS DISTINCT FROM OLD.outlet_id
        OR NEW.organization_id    IS DISTINCT FROM OLD.organization_id
        OR NEW.staff_id           IS DISTINCT FROM OLD.staff_id
        OR NEW.assigned_date      IS DISTINCT FROM OLD.assigned_date
        OR NEW.due_date           IS DISTINCT FROM OLD.due_date
        OR NEW.due_time           IS DISTINCT FROM OLD.due_time
        OR NEW.reschedule_approved_at IS DISTINCT FROM OLD.reschedule_approved_at
        OR NEW.reschedule_approved_by IS DISTINCT FROM OLD.reschedule_approved_by
        THEN
            RAISE EXCEPTION
                'A branch may record completion or request a reschedule, but may not '
                'change the assignment or approve its own reschedule.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_branch_assignment_update ON public.task_assignments;
CREATE TRIGGER trg_guard_branch_assignment_update
    BEFORE UPDATE ON public.task_assignments
    FOR EACH ROW EXECUTE FUNCTION public.guard_branch_assignment_update();

-- schedules
CREATE POLICY monthly_admin_all ON public.monthly_schedules
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

CREATE POLICY monthly_branch_read ON public.monthly_schedules
    FOR SELECT TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_outlet());

CREATE POLICY daily_admin_all ON public.daily_schedules
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

CREATE POLICY daily_branch_read ON public.daily_schedules
    FOR SELECT TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_outlet());

-- task_completion_proofs: previously RLS-on with no policies, so permanently
-- unreadable. A branch attaches proof to its own assignments.
CREATE POLICY proofs_admin_read ON public.task_completion_proofs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.task_assignments a
        WHERE a.id = assignment_id
          AND a.organization_id = public.app_org_id()
          AND public.app_is_admin()
    ));

CREATE POLICY proofs_branch_rw ON public.task_completion_proofs
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.task_assignments a
        WHERE a.id = assignment_id AND a.outlet_id = public.app_outlet_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.task_assignments a
        WHERE a.id = assignment_id AND a.outlet_id = public.app_outlet_id()
    ));

ALTER TABLE public.task_completion_proofs DROP CONSTRAINT IF EXISTS task_completion_proofs_assignment_id_fkey;
ALTER TABLE public.task_completion_proofs
    ADD CONSTRAINT task_completion_proofs_assignment_id_fkey
    FOREIGN KEY (assignment_id) REFERENCES public.task_assignments(id) ON DELETE CASCADE;
ALTER TABLE public.task_completion_proofs ALTER COLUMN assignment_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proofs_assignment ON public.task_completion_proofs(assignment_id);

-- invitations: owner-only. Pre-auth access is exclusively through the RPCs.
CREATE POLICY invitations_admin_all ON public.invitations
    FOR ALL TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin())
    WITH CHECK (organization_id = public.app_org_id() AND public.app_is_admin());

-- agent_actions: readable by the owner, written only by service_role. There is
-- deliberately no INSERT policy, so an audit trail cannot be forged from a
-- client session.
CREATE POLICY audit_admin_read ON public.agent_actions
    FOR SELECT TO authenticated
    USING (organization_id = public.app_org_id() AND public.app_is_admin());

-- ===========================================================================
-- 20. PROOF STORAGE
-- ===========================================================================
--
-- There was no bucket, which is the real reason TaskCompletion.tsx never
-- uploaded anything. Private, with paths shaped <organization_id>/<assignment_id>/<file>
-- so the first path segment can be matched against the caller's claim.

-- Wrapped in an exception block on purpose. Depending on how the project was
-- provisioned, the SQL editor role may not own storage.objects, and a bare
-- permission error here would roll back this entire migration over a bucket.
-- A caught exception in a DO block is a subtransaction, so the rest survives and
-- you finish the bucket by hand in the dashboard.

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'task-proofs', 'task-proofs', FALSE, 26214400,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
    )
    ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING
        'Could not create the task-proofs bucket (%). Create it manually: private, 25 MB limit. '
        'Everything else in this migration still applied.', SQLERRM;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS proofs_read   ON storage.objects;
    DROP POLICY IF EXISTS proofs_insert ON storage.objects;

    -- Paths are <organization_id>/<assignment_id>/<file>, so the first segment
    -- is matched against the caller's own claim.
    CREATE POLICY proofs_read ON storage.objects
        FOR SELECT TO authenticated
        USING (
            bucket_id = 'task-proofs'
            AND (storage.foldername(name))[1] = public.app_org_id()::text
        );

    -- Proof is evidence: no UPDATE or DELETE policy exists, so it cannot be
    -- altered or removed from a client session once written.
    CREATE POLICY proofs_insert ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'task-proofs'
            AND (storage.foldername(name))[1] = public.app_org_id()::text
        );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING
        'Could not create storage policies (%). Add them in the dashboard against '
        'bucket task-proofs. Everything else in this migration still applied, and '
        'verify_rebuild.sql will flag this.', SQLERRM;
END $$;

COMMIT;

-- ===========================================================================
-- WHAT THIS DID NOT DO
-- ===========================================================================
--
-- * Register the access token hook. Dashboard > Authentication > Hooks. Until
--   then every policy denies, because no token carries claims.
-- * Give the two outlets without logins an auth account. That needs the auth
--   admin API from an Edge Function.
-- * Enable leaked-password protection, or upgrade Postgres off the version with
--   outstanding security patches. Both are dashboard settings.
-- * Touch the React app. It still writes to tables directly and still contains
--   the "default to admin" fallback in authAPI.login, which must be removed.
--
-- Run supabase/verify_rebuild.sql afterwards to confirm the result.
