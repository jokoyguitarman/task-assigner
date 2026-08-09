-- 0011_limits_and_digest
--
-- Two unrelated gaps closed together: plan limits that were displayed but never
-- enforced, and a morning summary now that there is a channel to deliver one on.

BEGIN;

-- ---------------------------------------------------------------------------
-- Plan limits
-- ---------------------------------------------------------------------------
--
-- The can_add_* functions already existed and nothing called them, so nothing
-- stopped an organization exceeding its plan. Checking in the client alone would be
-- theatre, since the API is reachable directly - so this lives in the database, and
-- the client checks first only to produce a sentence instead of a constraint error.
--
-- This is only meaningful because owners can no longer raise their own limits, which
-- column grants stopped in 0005. Without that this would be a lock with the key
-- taped to it.
--
-- UPDATE is covered as well as INSERT: reactivating something deactivated is the
-- other way over the line, and an insert-only trigger would miss it.

CREATE OR REPLACE FUNCTION public.enforce_outlet_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_max INTEGER; v_used INTEGER;
BEGIN
    IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN RETURN NEW; END IF;

    SELECT max_restaurants INTO v_max FROM public.organizations WHERE id = NEW.organization_id;
    SELECT COUNT(*) INTO v_used FROM public.outlets
     WHERE organization_id = NEW.organization_id AND is_active = true AND id <> NEW.id;

    IF v_max IS NOT NULL AND v_used >= v_max THEN
        RAISE EXCEPTION 'Your plan covers % branches. Deactivate one or upgrade to add another.', v_max;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS outlets_limit ON public.outlets;
CREATE TRIGGER outlets_limit BEFORE INSERT OR UPDATE ON public.outlets
    FOR EACH ROW EXECUTE FUNCTION public.enforce_outlet_limit();

CREATE OR REPLACE FUNCTION public.enforce_staff_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_max INTEGER; v_used INTEGER;
BEGIN
    IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN RETURN NEW; END IF;

    SELECT max_employees INTO v_max FROM public.organizations WHERE id = NEW.organization_id;
    SELECT COUNT(*) INTO v_used FROM public.staff_profiles
     WHERE organization_id = NEW.organization_id AND is_active = true AND id <> NEW.id;

    IF v_max IS NOT NULL AND v_used >= v_max THEN
        RAISE EXCEPTION 'Your plan covers % people. Deactivate someone or upgrade to enrol another.', v_max;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS staff_limit ON public.staff_profiles;
CREATE TRIGGER staff_limit BEFORE INSERT OR UPDATE ON public.staff_profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_limit();

-- Branch logins are not admins; they are bounded by the branch limit instead, so
-- only role 'admin' is counted here.
CREATE OR REPLACE FUNCTION public.enforce_admin_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_max INTEGER; v_used INTEGER;
BEGIN
    IF NEW.role <> 'admin' THEN RETURN NEW; END IF;

    SELECT max_admins INTO v_max FROM public.organizations WHERE id = NEW.organization_id;
    SELECT COUNT(*) INTO v_used FROM public.users
     WHERE organization_id = NEW.organization_id AND role = 'admin' AND id <> NEW.id;

    IF v_max IS NOT NULL AND v_used >= v_max THEN
        RAISE EXCEPTION 'Your plan covers % admin accounts.', v_max;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_admin_limit ON public.users;
CREATE TRIGGER users_admin_limit BEFORE INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_limit();

-- ---------------------------------------------------------------------------
-- Morning summary
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.digest_preferences (
    user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    send_at         TIME NOT NULL DEFAULT '07:00',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    -- Stops the hourly job sending the same digest again within the same hour.
    last_sent_on    DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.digest_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY digest_own ON public.digest_preferences FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND organization_id = public.app_org_id());

REVOKE ALL ON public.digest_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_preferences TO authenticated;

-- How a business day went, per branch. "Late" is measured against the deadline
-- resolved in the organization's timezone, the same way every other part of the
-- system decides lateness.
CREATE OR REPLACE FUNCTION public.digest_for(p_org UUID, p_day DATE)
RETURNS TABLE (outlet_name TEXT, total INTEGER, completed INTEGER, finished_late INTEGER, missed INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
    SELECT o.name,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE a.status = 'completed')::INTEGER,
           COUNT(*) FILTER (
             WHERE a.status = 'completed'
               AND a.completed_at > ((a.due_date + COALESCE(a.due_time,'23:59:59'::time))
                                     AT TIME ZONE COALESCE(org.timezone,'UTC'))
           )::INTEGER,
           COUNT(*) FILTER (WHERE a.status <> 'completed')::INTEGER
      FROM public.task_assignments a
      JOIN public.organizations org ON org.id = a.organization_id
      JOIN public.outlets o ON o.id = a.outlet_id
     WHERE a.organization_id = p_org AND a.assigned_date = p_day
     GROUP BY o.name ORDER BY o.name;
$$;

REVOKE ALL ON FUNCTION public.digest_for(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.digest_for(UUID, DATE) TO authenticated, service_role;

-- Who is due one right now: enabled, their chosen hour has arrived in their own
-- timezone, and they have not had one today. The hourly job is therefore a no-op
-- for most of the day, which is what makes an hourly cadence affordable while still
-- honouring any timezone.
CREATE OR REPLACE FUNCTION public.digests_due()
RETURNS TABLE (user_id UUID, organization_id UUID, business_day DATE)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
    SELECT d.user_id, d.organization_id,
           ((NOW() AT TIME ZONE COALESCE(o.timezone,'UTC'))::date - 1)
      FROM public.digest_preferences d
      JOIN public.organizations o ON o.id = d.organization_id
     WHERE d.enabled
       AND (NOW() AT TIME ZONE COALESCE(o.timezone,'UTC'))::time >= d.send_at
       AND (d.last_sent_on IS NULL
            OR d.last_sent_on < (NOW() AT TIME ZONE COALESCE(o.timezone,'UTC'))::date);
$$;

REVOKE ALL ON FUNCTION public.digests_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.digests_due() TO service_role;

COMMIT;

-- Sent by the send-digest Edge Function, which authenticates on the same shared
-- secret as the escalation sender.
SELECT cron.schedule(
    'send-digest',
    '12 * * * *',
    $j$
    SELECT net.http_post(
        url     := 'https://xwavgpleyxdbrhyvqsoj.supabase.co/functions/v1/send-digest',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-job-secret', (SELECT value FROM public.app_keys WHERE name = 'job_secret')
                   ),
        body    := '{}'::jsonb
    );
    $j$
);
