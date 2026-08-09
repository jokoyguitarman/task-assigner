-- 0009_owner_push_alerts
--
-- The dashboard could tell the owner a branch was stuck, but only once they chose
-- to open it, which is the habit this product exists to replace. This is the piece
-- that reaches out instead of waiting to be checked.
--
-- Web push, sent by the app itself: no SMS bill, no third-party messaging account,
-- nothing to sign up for. Reliable on Android and desktop; on iPhone it requires
-- the app be added to the home screen first, which is Apple's restriction rather
-- than a choice made here.

BEGIN;

-- ---------------------------------------------------------------------------
-- Signing keys
-- ---------------------------------------------------------------------------
--
-- Web push signs each message with a VAPID key pair. There is no secret store
-- reachable from the tooling used to apply this, so the pair lives in a table
-- that RLS and grants close to every client role; only the Edge Function, running
-- as service_role, can read it. Move it to a managed secret if one becomes
-- available - the private key's blast radius is limited to sending notifications
-- to this app's own subscribers, but it is still a key in a table.

CREATE TABLE IF NOT EXISTS public.app_keys (
    name       TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_keys FROM anon, authenticated;

-- A public key is meant to be public: it identifies the sender and cannot send
-- anything. Exposed through a function so the row itself stays unreadable and the
-- private key beside it cannot be reached by widening a policy later.
CREATE OR REPLACE FUNCTION public.get_vapid_public_key()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT value FROM public.app_keys WHERE name = 'vapid_public'; $$;

REVOKE ALL ON FUNCTION public.get_vapid_public_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO authenticated;

-- ---------------------------------------------------------------------------
-- Subscribed devices
-- ---------------------------------------------------------------------------
--
-- One row per device rather than per person, so an owner with a phone and a laptop
-- is told on both. A device can only ever see or remove its own rows.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_own_read ON public.push_subscriptions FOR SELECT TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY push_own_insert ON public.push_subscriptions FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND organization_id = public.app_org_id());
CREATE POLICY push_own_delete ON public.push_subscriptions FOR DELETE TO authenticated
    USING (user_id = auth.uid());

REVOKE ALL ON public.push_subscriptions FROM anon;
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;

-- ---------------------------------------------------------------------------
-- What deserves an interruption
-- ---------------------------------------------------------------------------
--
-- Past its deadline by the organization's grace window, still not done, and never
-- alerted before. The once-only rule is the important half: an alert that repeats
-- every fifteen minutes until someone acts is an alert people mute, and a muted
-- alert is worse than none because it feels like coverage.

ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS owner_alerted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.escalations_awaiting_owner()
RETURNS TABLE (id UUID, organization_id UUID, outlet_name TEXT, task_title TEXT, minutes_late INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
    SELECT a.id, a.organization_id, o.name, t.title,
           (EXTRACT(EPOCH FROM (NOW() - ((a.due_date + COALESCE(a.due_time,'23:59:59'::time))
                                          AT TIME ZONE COALESCE(org.timezone,'UTC')))) / 60)::INTEGER
      FROM public.task_assignments a
      JOIN public.organizations org ON org.id = a.organization_id
      JOIN public.outlets o ON o.id = a.outlet_id
      JOIN public.tasks t ON t.id = a.task_id
     WHERE a.status <> 'completed'
       AND a.owner_alerted_at IS NULL
       AND NOW() >= ((a.due_date + COALESCE(a.due_time,'23:59:59'::time))
                     AT TIME ZONE COALESCE(org.timezone,'UTC'))
                    + make_interval(mins => COALESCE(org.owner_alert_grace_minutes, 30));
$$;

REVOKE ALL ON FUNCTION public.escalations_awaiting_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalations_awaiting_owner() TO service_role;

-- Work already overdue at the time this shipped was overdue against placeholder
-- shift times nobody had corrected yet. Marking it alerted starts the count from
-- now, rather than teaching the owner on day one that these alerts are noise.
UPDATE public.task_assignments
   SET owner_alerted_at = NOW()
 WHERE status <> 'completed' AND owner_alerted_at IS NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------
--
-- The sender is the notify-owner Edge Function, which authenticates on a shared
-- secret rather than a user session, because a scheduled job has no session. It is
-- deployed with JWT verification off for that reason, and refuses every request
-- that does not present the secret before doing any work.
--
-- The secret is read at call time rather than written into the schedule, so it does
-- not sit in cron.job in plain sight. Runs five minutes after each overdue sweep so
-- it always acts on freshly marked work.

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
    'notify-owner',
    '5,20,35,50 * * * *',
    $j$
    SELECT net.http_post(
        url     := 'https://xwavgpleyxdbrhyvqsoj.supabase.co/functions/v1/notify-owner',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-job-secret', (SELECT value FROM public.app_keys WHERE name = 'job_secret')
                   ),
        body    := '{}'::jsonb
    );
    $j$
);
