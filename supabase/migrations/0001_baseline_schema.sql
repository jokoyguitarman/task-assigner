-- 0001_baseline_schema
--
-- Baseline for Task Assigner, transcribed from the live database on 2026-08-06
-- via the Postgres catalog (information_schema.columns, pg_constraint, pg_indexes,
-- pg_proc, pg_trigger, pg_policies).
--
-- This file is a RECORD OF WHAT IS DEPLOYED, not a statement of what is correct.
-- It contains several things that are actively wrong: plaintext password columns,
-- duplicate priority columns on tasks, an RLS policy set with a cross-tenant leak,
-- a signup trigger that grants admin based on an email substring, and triggers
-- that write directly into auth.users. Each is annotated below and each is
-- corrected in a later numbered migration. Reproducing them faithfully here is
-- what makes those later migrations reviewable.
--
-- Every statement guards against pre-existing objects, so this is safe to run
-- against the live database. That also means it will not reshape a table that
-- already exists in a different form.
--
-- See SCHEMA_NOTES.md for the verified findings and the remediation order.

-- ---------------------------------------------------------------------------
-- Organizations (tenant root)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'standard', 'professional')),
    subscription_status VARCHAR(20) DEFAULT 'active'
        CHECK (subscription_status IN ('active', 'trial', 'expired')),
    max_admins INTEGER DEFAULT 1,
    max_restaurants INTEGER DEFAULT 1,
    max_employees INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Users (application profile)
-- ---------------------------------------------------------------------------
--
-- id has NO foreign key to auth.users and defaults to gen_random_uuid(). Profile
-- rows can therefore exist with no login, which is the current state of most of
-- this table. Corrected in 0004.

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'outlet')),
    organization_id UUID REFERENCES public.organizations(id),
    is_primary_admin BOOLEAN DEFAULT FALSE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_clear_board_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_streak ON public.users(current_streak);
CREATE INDEX IF NOT EXISTS idx_users_last_clear ON public.users(last_clear_board_date);

-- ---------------------------------------------------------------------------
-- Staff positions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.staff_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Outlets (branches)
-- ---------------------------------------------------------------------------
--
-- password stores a plaintext credential. Dropped in 0005 once outlets hold real
-- auth accounts. Note that user_id points at auth.users while manager_id points
-- at public.users; the two are unrelated columns despite both naming a person.

CREATE TABLE IF NOT EXISTS public.outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    manager_id UUID REFERENCES public.users(id),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    username TEXT,
    password TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlets_organization_id ON public.outlets(organization_id);
CREATE INDEX IF NOT EXISTS idx_outlets_user_id ON public.outlets(user_id);
CREATE INDEX IF NOT EXISTS idx_outlets_username ON public.outlets(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_outlet_username ON public.outlets(username) WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Staff profiles
-- ---------------------------------------------------------------------------
--
-- employee_id is UNIQUE but nullable, so a second profile with a null employee_id
-- is accepted. password is plaintext and dropped in 0005.

CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    position_id UUID REFERENCES public.staff_positions(id),
    employee_id TEXT UNIQUE,
    hire_date DATE,
    organization_id UUID REFERENCES public.organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    username TEXT,
    password TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_organization_id ON public.staff_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_username ON public.staff_profiles(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_staff_username ON public.staff_profiles(username) WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Tasks (templates)
-- ---------------------------------------------------------------------------
--
-- ishighpriority and is_high_priority are two independent columns holding the
-- same concept. Both are NOT NULL DEFAULT FALSE, nothing keeps them in step, and
-- they already disagree on several rows. The indexes read ishighpriority; the
-- TypeScript reads is_high_priority. Collapsed to one column in 0006.

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    estimated_minutes INTEGER NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_pattern TEXT CHECK (recurring_pattern IN ('daily', 'weekly', 'monthly')),
    scheduled_date DATE,
    ishighpriority BOOLEAN NOT NULL DEFAULT FALSE,
    is_high_priority BOOLEAN NOT NULL DEFAULT FALSE,
    organization_id UUID REFERENCES public.organizations(id),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(ishighpriority);
CREATE INDEX IF NOT EXISTS idx_tasks_high_priority ON public.tasks(id) WHERE ishighpriority = TRUE;

-- ---------------------------------------------------------------------------
-- Task assignments (instances)
-- ---------------------------------------------------------------------------
--
-- staff_id references staff_profiles(id), NOT users(id). This matters: the
-- "task_assignments_staff_own" policy below compares staff_id to auth.uid(),
-- which is an auth user id, so it can never match and the policy is dead. That
-- dead policy is why "task_assignments_realtime_access" USING (true) was added.
--
-- due_time exists and is populated on zero rows. AssignmentForm collects it and
-- then discards it before the insert.

CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id),
    staff_id UUID REFERENCES public.staff_profiles(id),
    outlet_id UUID REFERENCES public.outlets(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    assigned_date DATE NOT NULL,
    due_date DATE NOT NULL,
    due_time TIME,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'overdue', 'reschedule_requested')),
    completed_at TIMESTAMP,
    completion_proof TEXT,
    minutes_deducted INTEGER DEFAULT 0,
    reschedule_requested_at TIMESTAMPTZ,
    reschedule_reason TEXT,
    reschedule_requested_by UUID REFERENCES public.users(id),
    reschedule_approved_at TIMESTAMPTZ,
    reschedule_approved_by UUID REFERENCES public.users(id),
    reschedule_new_due_date TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_organization_id ON public.task_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_reschedule_requested_at ON public.task_assignments(reschedule_requested_at);
CREATE INDEX IF NOT EXISTS idx_task_assignments_reschedule_requested_by ON public.task_assignments(reschedule_requested_by);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status_reschedule
    ON public.task_assignments(status) WHERE status = 'reschedule_requested';

-- No index on staff_id, outlet_id, task_id, due_date or status. Every dashboard
-- query filters on at least one of them. Added in 0006.

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
--
-- monthly_schedules has no UNIQUE (staff_id, month, year), so MonthlyScheduler
-- can produce duplicate months for one person. daily_schedules has no UNIQUE on
-- (monthly_schedule_id, schedule_date) either, and no cascade from its parent.

CREATE TABLE IF NOT EXISTS public.monthly_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.staff_profiles(id),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    organization_id UUID REFERENCES public.organizations(id),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_schedules_organization_id ON public.monthly_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_staff ON public.monthly_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_date ON public.monthly_schedules(year, month);

-- day_off_type's CHECK rejects the empty string. MonthlyScheduler initialises the
-- field to '' for work days, so it must send NULL rather than '' or the insert
-- fails. There is no constraint tying is_day_off to the presence of outlet_id or
-- hours, so a "day off" row can still carry a shift.

CREATE TABLE IF NOT EXISTS public.daily_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monthly_schedule_id UUID REFERENCES public.monthly_schedules(id),
    schedule_date DATE NOT NULL,
    outlet_id UUID REFERENCES public.outlets(id),
    organization_id UUID REFERENCES public.organizations(id),
    time_in TIME,
    time_out TIME,
    is_day_off BOOLEAN DEFAULT FALSE,
    day_off_type TEXT CHECK (day_off_type IN ('vacation', 'sick', 'personal', 'other')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_schedules_organization_id ON public.daily_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_date ON public.daily_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_monthly ON public.daily_schedules(monthly_schedule_id);

-- Empty, and nothing in the application reads or writes it.

CREATE TABLE IF NOT EXISTS public.staff_working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.staff_profiles(id),
    date DATE NOT NULL,
    total_minutes INTEGER DEFAULT 0,
    deducted_minutes INTEGER DEFAULT 0,
    net_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Completion proofs
-- ---------------------------------------------------------------------------
--
-- Empty. The column is file_path, not file_url, and there is no storage bucket
-- for it to point into. TaskCompletion.tsx collects photos and drops them.

CREATE TABLE IF NOT EXISTS public.task_completion_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.task_assignments(id),
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
    file_size INTEGER,
    created_by UUID REFERENCES public.users(id),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('staff', 'outlet')),
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON public.invitations(organization_id);

-- ---------------------------------------------------------------------------
-- Identity helper functions
-- ---------------------------------------------------------------------------
--
-- All SECURITY DEFINER, which is what breaks the policy recursion: a policy on
-- users that called users directly would loop, but a definer function bypasses
-- RLS on the inner read. None of them pin search_path, and all are granted to
-- anon, so each is reachable as an unauthenticated RPC. 0003 replaces these with
-- JWT claim reads.

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id FROM users WHERE id = auth.uid();
  RETURN org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'staff');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_outlet_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'outlet');
END;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND organization_id = org_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Tier limit functions
-- ---------------------------------------------------------------------------
--
-- current_employees and employees_used count every user in the organization,
-- admins and outlet logins included, so an owner on the free tier burns employee
-- slots on themselves. get_organization_limits also omits subscription_tier even
-- though the TierLimits interface in src/services/tierLimitsService.ts declares
-- it, so that field arrives undefined. Both fixed in 0006, which must DROP the
-- functions first because CREATE OR REPLACE cannot change a return type.

CREATE OR REPLACE FUNCTION public.get_organization_limits(org_id UUID)
RETURNS TABLE (
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
    (SELECT COUNT(*) FROM outlets WHERE organization_id = org_id AND is_active = TRUE),
    (SELECT COUNT(*) FROM users WHERE organization_id = org_id)
  FROM organizations o
  WHERE o.id = org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_admin(org_id UUID)
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

CREATE OR REPLACE FUNCTION public.can_add_restaurant(org_id UUID)
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

CREATE OR REPLACE FUNCTION public.can_add_employee(org_id UUID)
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

CREATE OR REPLACE FUNCTION public.get_organization_usage_stats(org_id UUID)
RETURNS TABLE (
    admins_used INTEGER,
    admins_max INTEGER,
    restaurants_used INTEGER,
    restaurants_max INTEGER,
    employees_used INTEGER,
    employees_max INTEGER,
    subscription_tier VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM users WHERE organization_id = org_id AND role = 'admin'),
    o.max_admins,
    (SELECT COUNT(*)::INTEGER FROM outlets WHERE organization_id = org_id AND is_active = TRUE),
    o.max_restaurants,
    (SELECT COUNT(*)::INTEGER FROM users WHERE organization_id = org_id),
    o.max_employees,
    o.subscription_tier
  FROM organizations o
  WHERE o.id = org_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Signup triggers
-- ---------------------------------------------------------------------------
--
-- handle_new_user grants the admin role to any address containing the substring
-- "admin" or "manager". Anyone who signs up as admin@<anything> becomes an admin.
-- It also leaves organization_id null, so the profile it creates is tenantless.
-- Replaced in 0002.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
    CASE
      WHEN NEW.email IN (
        'admin@yourcompany.com',
        'manager@yourcompany.com',
        'youremail@domain.com'
      ) THEN 'admin'
      WHEN NEW.email LIKE '%admin%' THEN 'admin'
      WHEN NEW.email LIKE '%manager%' THEN 'admin'
      ELSE 'staff'
    END,
    NEW.created_at,
    NEW.updated_at
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    name = COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      public.users.name,
      SPLIT_PART(NEW.email, '@', 1)
    ),
    updated_at = NEW.updated_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_updated') THEN
        CREATE TRIGGER on_auth_user_updated
            AFTER UPDATE ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Staff and outlet credential triggers
-- ---------------------------------------------------------------------------
--
-- These hand-roll rows into auth.users, hashing with crypt() and filling GoTrue's
-- internal columns by hand. The pair is destructive in combination: the cleanup
-- trigger fires BEFORE every UPDATE on staff_profiles and deletes the auth user
-- derived from OLD.username, while the create trigger fires AFTER and only
-- recreates it when a password is present. Since no staff row currently stores a
-- password, any edit to a staff profile deletes that person's login and does not
-- restore it. Both are dropped in 0002.
--
-- The generated address is <username>+staff@taskassigner.local, which is not a
-- deliverable domain, so these accounts can never reset a password.

CREATE OR REPLACE FUNCTION public.create_auth_user_for_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    auth_user_id UUID;
    fake_email TEXT;
    staff_name TEXT;
BEGIN
    IF NEW.username IS NOT NULL AND NEW.password IS NOT NULL AND NEW.username != '' AND NEW.password != '' THEN
        SELECT name INTO staff_name FROM public.users WHERE id = NEW.user_id;
        IF staff_name IS NULL THEN
            staff_name := 'Staff Member';
        END IF;

        fake_email := NEW.username || '+staff@taskassigner.local';

        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            created_at, updated_at, role, aud, confirmation_token,
            email_change_token_current, email_change_confirm_status, banned_until,
            recovery_token, email_change_token_new, email_change_sent_at,
            last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
            phone, phone_confirmed_at, phone_change_token, phone_change_sent_at,
            confirmed_at
        ) VALUES (
            gen_random_uuid(), '00000000-0000-0000-0000-000000000000', fake_email,
            crypt(NEW.password, gen_salt('bf')), NOW(), NOW(), NOW(),
            'authenticated', 'authenticated', '', '', 0, NULL, '', '', NULL, NULL,
            jsonb_build_object('provider', 'staff', 'staff_profile_id', NEW.id),
            jsonb_build_object('username', NEW.username, 'staff_name', staff_name,
                               'type', 'staff', 'employee_id', NEW.employee_id),
            FALSE, NULL, NULL, '', NULL, NOW()
        ) RETURNING id INTO auth_user_id;

        INSERT INTO public.users (id, email, name, role, created_at, updated_at)
        VALUES (auth_user_id, fake_email,
                staff_name || ' (' || NEW.employee_id || ')', 'staff', NOW(), NOW());
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_auth_user_for_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    fake_email TEXT;
    auth_user_id UUID;
BEGIN
    IF OLD.username IS NOT NULL AND OLD.username != '' THEN
        fake_email := OLD.username || '+staff@taskassigner.local';
        SELECT id INTO auth_user_id FROM auth.users WHERE email = fake_email;
        IF auth_user_id IS NOT NULL THEN
            DELETE FROM public.users WHERE id = auth_user_id;
            DELETE FROM auth.users WHERE id = auth_user_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_auth_user_for_outlet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    fake_email TEXT;
    auth_user_id UUID;
BEGIN
    IF OLD.username IS NOT NULL AND OLD.username != '' THEN
        fake_email := OLD.username || '+outlet@taskassigner.local';
        SELECT id INTO auth_user_id FROM auth.users WHERE email = fake_email;
        IF auth_user_id IS NOT NULL THEN
            DELETE FROM public.users WHERE id = auth_user_id;
            DELETE FROM auth.users WHERE id = auth_user_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_auth_user_for_staff') THEN
        CREATE TRIGGER trigger_create_auth_user_for_staff
            AFTER INSERT OR UPDATE ON public.staff_profiles
            FOR EACH ROW EXECUTE FUNCTION public.create_auth_user_for_staff();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_cleanup_auth_user_for_staff') THEN
        CREATE TRIGGER trigger_cleanup_auth_user_for_staff
            BEFORE DELETE OR UPDATE ON public.staff_profiles
            FOR EACH ROW EXECUTE FUNCTION public.cleanup_auth_user_for_staff();
    END IF;
END $$;

-- cleanup_auth_user_for_outlet exists but is attached to no trigger. The outlet
-- equivalents sync_existing_outlet_to_auth and sync_existing_staff_to_auth are
-- one-shot backfill helpers, also unattached; they are not reproduced here
-- because nothing calls them and 0002 drops them.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- Enabled on all twelve tables. Reproduced verbatim so that 0003 can be read as
-- a diff. Do not treat this section as a template. Postgres ORs permissive
-- policies together, so on every table the weakest policy is the effective one,
-- and several of these are wide open. Specifically:
--
--   * invitations is SELECT-able by the public role USING (true), twice. Anyone
--     holding the anon key can read every organization's invitation tokens and
--     redeem them.
--   * task_assignments_realtime_access is SELECT USING (true) for authenticated,
--     which makes every other policy on that table decorative and exposes all
--     assignments across all tenants to any signed-in account.
--   * "Users can update their own profile" restricts the row but not the columns,
--     because RLS cannot. Any user can set their own role to 'admin' and their own
--     organization_id to any tenant.
--   * anon may INSERT into users and organizations with WITH CHECK (true).
--   * staff_working_hours and task_completion_proofs have RLS on and no policies,
--     so they are unreadable to the client regardless of role.

ALTER TABLE public.organizations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_working_hours     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_proofs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations             ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN

-- organizations
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organizations' AND policyname='Users can view their own organization') THEN
    CREATE POLICY "Users can view their own organization" ON public.organizations
        FOR SELECT USING (id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organizations' AND policyname='Users can update their own organization') THEN
    CREATE POLICY "Users can update their own organization" ON public.organizations
        FOR UPDATE USING (id = current_user_organization_id())
        WITH CHECK (id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organizations' AND policyname='Allow anon insert for organization creation') THEN
    CREATE POLICY "Allow anon insert for organization creation" ON public.organizations
        FOR INSERT WITH CHECK (true);
END IF;

-- users
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can view users in their organization') THEN
    CREATE POLICY "Users can view users in their organization" ON public.users
        FOR SELECT USING (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON public.users
        FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Allow anon insert for signup') THEN
    CREATE POLICY "Allow anon insert for signup" ON public.users
        FOR INSERT WITH CHECK (true);
END IF;

-- staff_positions
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_positions' AND policyname='Allow authenticated read staff_positions') THEN
    CREATE POLICY "Allow authenticated read staff_positions" ON public.staff_positions
        FOR SELECT TO authenticated USING (true);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_positions' AND policyname='Allow authenticated users to read staff_positions') THEN
    CREATE POLICY "Allow authenticated users to read staff_positions" ON public.staff_positions
        FOR SELECT TO authenticated USING (true);
END IF;

-- outlets
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outlets' AND policyname='Users can view outlets in their organization') THEN
    CREATE POLICY "Users can view outlets in their organization" ON public.outlets
        FOR SELECT USING (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outlets' AND policyname='Users can manage outlets in their organization') THEN
    CREATE POLICY "Users can manage outlets in their organization" ON public.outlets
        FOR ALL USING (organization_id = current_user_organization_id())
        WITH CHECK (organization_id = current_user_organization_id());
END IF;

-- staff_profiles
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_profiles' AND policyname='Users can view staff profiles in their organization') THEN
    CREATE POLICY "Users can view staff profiles in their organization" ON public.staff_profiles
        FOR SELECT USING (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_profiles' AND policyname='Users can manage staff profiles in their organization') THEN
    CREATE POLICY "Users can manage staff profiles in their organization" ON public.staff_profiles
        FOR ALL USING (organization_id = current_user_organization_id())
        WITH CHECK (organization_id = current_user_organization_id());
END IF;

-- tasks
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='Users can view tasks in their organization') THEN
    CREATE POLICY "Users can view tasks in their organization" ON public.tasks
        FOR SELECT USING (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='Users can manage tasks in their organization') THEN
    CREATE POLICY "Users can manage tasks in their organization" ON public.tasks
        FOR ALL USING (organization_id = current_user_organization_id())
        WITH CHECK (organization_id = current_user_organization_id());
END IF;

-- task_assignments: eight overlapping policies, of which one grants everything.
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='Users can view task assignments in their organization') THEN
    CREATE POLICY "Users can view task assignments in their organization" ON public.task_assignments
        FOR SELECT USING (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='Users can manage task assignments in their organization') THEN
    CREATE POLICY "Users can manage task assignments in their organization" ON public.task_assignments
        FOR ALL USING (organization_id = current_user_organization_id())
        WITH CHECK (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='Users can manage assignments in their organization') THEN
    CREATE POLICY "Users can manage assignments in their organization" ON public.task_assignments
        FOR ALL USING (EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
              AND u.organization_id = (SELECT t.organization_id FROM tasks t WHERE t.id = task_assignments.task_id)
        ));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='Admin can manage all assignments') THEN
    CREATE POLICY "Admin can manage all assignments" ON public.task_assignments
        FOR ALL USING (
            EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.role = 'outlet'))
            OR current_setting('role') = 'service_role'
        );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='task_assignments_admin_all') THEN
    CREATE POLICY "task_assignments_admin_all" ON public.task_assignments
        FOR ALL TO authenticated USING (
            EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='task_assignments_outlet_own') THEN
    CREATE POLICY "task_assignments_outlet_own" ON public.task_assignments
        FOR ALL TO authenticated USING (
            outlet_id IN (
                SELECT outlets.id FROM outlets
                WHERE outlets.organization_id = (SELECT users.organization_id FROM users WHERE users.id = auth.uid())
            )
            OR EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid() AND users.role = 'outlet'
                  AND task_assignments.outlet_id IN (
                      SELECT outlets.id FROM outlets WHERE outlets.organization_id = users.organization_id
                  )
            )
        );
END IF;
-- Dead: staff_id holds a staff_profiles id, auth.uid() holds an auth user id.
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='task_assignments_staff_own') THEN
    CREATE POLICY "task_assignments_staff_own" ON public.task_assignments
        FOR ALL TO authenticated USING (
            staff_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid() AND users.role = 'staff' AND task_assignments.staff_id = auth.uid()
            )
        );
END IF;
-- The cross-tenant leak. Added to make Realtime deliver events after the policy
-- above turned out never to match.
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='task_assignments_realtime_access') THEN
    CREATE POLICY "task_assignments_realtime_access" ON public.task_assignments
        FOR SELECT TO authenticated USING (true);
END IF;

-- monthly_schedules
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_schedules' AND policyname='Users can view monthly schedules in their organization') THEN
    CREATE POLICY "Users can view monthly schedules in their organization" ON public.monthly_schedules
        FOR SELECT USING (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_schedules' AND policyname='Users can manage monthly schedules in their organization') THEN
    CREATE POLICY "Users can manage monthly schedules in their organization" ON public.monthly_schedules
        FOR ALL USING (organization_id = current_user_organization_id())
        WITH CHECK (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_schedules' AND policyname='Admin full access to monthly schedules') THEN
    CREATE POLICY "Admin full access to monthly schedules" ON public.monthly_schedules
        FOR ALL USING (is_admin());
END IF;

-- daily_schedules
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_schedules' AND policyname='Users can view daily schedules in their organization') THEN
    CREATE POLICY "Users can view daily schedules in their organization" ON public.daily_schedules
        FOR SELECT USING (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_schedules' AND policyname='Users can manage daily schedules in their organization') THEN
    CREATE POLICY "Users can manage daily schedules in their organization" ON public.daily_schedules
        FOR ALL USING (organization_id = current_user_organization_id())
        WITH CHECK (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_schedules' AND policyname='Admin full access to daily schedules') THEN
    CREATE POLICY "Admin full access to daily schedules" ON public.daily_schedules
        FOR ALL USING (is_admin());
END IF;

-- invitations: seven policies, two of which are FOR SELECT USING (true) to public.
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invitations' AND policyname='Allow public read invitations by token') THEN
    CREATE POLICY "Allow public read invitations by token" ON public.invitations
        FOR SELECT USING (true);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invitations' AND policyname='Public read invitations for signup') THEN
    CREATE POLICY "Public read invitations for signup" ON public.invitations
        FOR SELECT USING (true);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invitations' AND policyname='Users can view invitations sent to them') THEN
    CREATE POLICY "Users can view invitations sent to them" ON public.invitations
        FOR SELECT TO authenticated
        USING (email = (SELECT users.email FROM users WHERE users.id = auth.uid()));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invitations' AND policyname='Users can update their own invitations') THEN
    CREATE POLICY "Users can update their own invitations" ON public.invitations
        FOR UPDATE TO authenticated
        USING (email = (SELECT users.email FROM users WHERE users.id = auth.uid()))
        WITH CHECK (email = (SELECT users.email FROM users WHERE users.id = auth.uid()));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invitations' AND policyname='Users can manage invitations in their organization') THEN
    CREATE POLICY "Users can manage invitations in their organization" ON public.invitations
        FOR ALL USING (organization_id = current_user_organization_id())
        WITH CHECK (organization_id = current_user_organization_id());
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invitations' AND policyname='Admin can manage all invitations') THEN
    CREATE POLICY "Admin can manage all invitations" ON public.invitations
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
        WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invitations' AND policyname='Admin full access to invitations') THEN
    CREATE POLICY "Admin full access to invitations" ON public.invitations
        FOR ALL USING (is_admin());
END IF;

END $$;

-- ---------------------------------------------------------------------------
-- Default staff positions
-- ---------------------------------------------------------------------------

INSERT INTO public.staff_positions (name, description, is_custom)
SELECT * FROM (VALUES
    ('Manager',         'Oversees operations',    FALSE),
    ('Supervisor',      'Supervises staff',       FALSE),
    ('Cashier',         'Handles transactions',   FALSE),
    ('Cook/Chef',       'Prepares food',          FALSE),
    ('Server/Waiter',   'Serves customers',       FALSE),
    ('Cleaner/Janitor', 'Maintains cleanliness',  FALSE),
    ('Security',        'Ensures safety',         FALSE)
) AS v(name, description, is_custom)
WHERE NOT EXISTS (SELECT 1 FROM public.staff_positions LIMIT 1);
