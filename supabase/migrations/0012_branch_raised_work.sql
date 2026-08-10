-- 0012_branch_raised_work
--
-- A branch noticing something that needs doing — a filthy extractor fan, a wobbly
-- shelf — and putting it on their own list.
--
-- The obvious design was a request board the owner approves. That was the wrong one.
-- This product is for businesses too small to employ a manager, which means the owner
-- IS the bottleneck an approval queue reintroduces, and the whole premise is removing
-- them from loops they keep forgetting. There is already evidence of what happens: a
-- reschedule request sat unanswered in this database for eleven months.
--
-- So the pattern is the one already used for reassignment: not permission, but
-- attribution. The branch may act; the record of who acted and why is permanent.

BEGIN;

-- A task raised by a branch is not a standard. It is never recurring and never fans
-- out anywhere, which is the distinction that makes this safe: a `tasks` row is
-- normally an organization-wide standard, and a branch writing one of those would
-- silently impose its judgement on every other location.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS raised_by_outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS raised_by_staff_id  UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS photo_path TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_raised_by ON public.tasks(raised_by_outlet_id);

COMMENT ON COLUMN public.tasks.raised_by_outlet_id IS
    'Set when a branch raised this itself rather than the owner setting it as a '
    'standard. Such a task is never recurring and never reaches another branch.';

-- ---------------------------------------------------------------------------
-- Raising it
-- ---------------------------------------------------------------------------
--
-- One server-side call rather than granting a branch INSERT on tasks and assignments.
-- A policy can say which rows a caller may write but not which values, and the value
-- that matters here is the deadline: given the chance, a branch could give itself
-- until next week. So the deadline is derived here from the branch's own shift,
-- exactly as the nightly job does it, including the rollover for a shift running past
-- midnight.

CREATE OR REPLACE FUNCTION public.raise_branch_task(
    p_title      TEXT,
    p_area_id    UUID,
    p_shift_id   UUID,
    p_staff_id   UUID,
    p_note       TEXT DEFAULT NULL,
    p_photo_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
    v_outlet UUID := public.app_outlet_id();
    v_org    UUID := public.app_org_id();
    v_uid    UUID := auth.uid();
    v_starts TIME;
    v_ends   TIME;
    v_today  DATE;
    v_task   UUID;
    v_assign UUID;
BEGIN
    IF NOT public.app_is_outlet() OR v_outlet IS NULL THEN
        RAISE EXCEPTION 'Only a branch can raise work for itself';
    END IF;

    IF COALESCE(btrim(p_title), '') = '' THEN
        RAISE EXCEPTION 'Say what needs doing';
    END IF;

    SELECT os.starts_at, os.ends_at INTO v_starts, v_ends
      FROM public.outlet_shifts os
     WHERE os.outlet_id = v_outlet AND os.shift_id = p_shift_id;

    IF v_ends IS NULL THEN
        RAISE EXCEPTION 'That is not a shift this branch runs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.outlet_areas oa
                    WHERE oa.outlet_id = v_outlet AND oa.area_id = p_area_id) THEN
        RAISE EXCEPTION 'That is not an area this branch has';
    END IF;

    -- Whoever noticed must be on this branch's roster, so the attribution means
    -- something rather than being a free-text claim about a stranger.
    IF p_staff_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.staff_profiles sp
         WHERE sp.id = p_staff_id AND sp.outlet_id = v_outlet
    ) THEN
        RAISE EXCEPTION 'That person is not on this branch roster';
    END IF;

    SELECT (NOW() AT TIME ZONE COALESCE(o.timezone,'UTC'))::date INTO v_today
      FROM public.organizations o WHERE o.id = v_org;

    INSERT INTO public.tasks (
        title, description, estimated_minutes, is_recurring, is_high_priority,
        shift_id, area_id, organization_id, raised_by_outlet_id, raised_by_staff_id,
        photo_path, created_by
    ) VALUES (
        btrim(p_title), NULLIF(btrim(COALESCE(p_note,'')), ''), 15, false, false,
        p_shift_id, p_area_id, v_org, v_outlet, p_staff_id, p_photo_path, v_uid
    ) RETURNING id INTO v_task;

    INSERT INTO public.task_assignments (
        task_id, staff_id, outlet_id, organization_id, assigned_date, due_date, due_time, status
    ) VALUES (
        v_task, p_staff_id, v_outlet, v_org,
        v_today,
        v_today + CASE WHEN v_ends <= v_starts THEN 1 ELSE 0 END,
        v_ends,
        'pending'
    ) RETURNING id INTO v_assign;

    INSERT INTO public.agent_actions (organization_id, actor_user_id, actor_role, source, operation, arguments)
    VALUES (v_org, v_uid, 'outlet', 'app', 'raise_branch_task',
            jsonb_build_object('task_id', v_task, 'assignment_id', v_assign, 'outlet_id', v_outlet));

    RETURN v_assign;
END;
$$;

REVOKE ALL ON FUNCTION public.raise_branch_task(TEXT, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_branch_task(TEXT, UUID, UUID, UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Keeping the numbers honest
-- ---------------------------------------------------------------------------
--
-- This is the part that is easy to get wrong. If branch-raised work counted the same
-- as work the owner asked for, a branch that reports five problems and fixes four
-- would score worse than one that notices nothing — the metric would quietly punish
-- initiative, which is the opposite of what it exists for.

-- Branch-raised work also never wakes the owner. Letting it ring the phone would make
-- reporting a way to set off alarms, and reporting is the behaviour to encourage. It
-- still appears on the dashboard and is mentioned in the morning summary.
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
       AND t.raised_by_outlet_id IS NULL
       AND NOW() >= ((a.due_date + COALESCE(a.due_time,'23:59:59'::time))
                     AT TIME ZONE COALESCE(org.timezone,'UTC'))
                    + make_interval(mins => COALESCE(org.owner_alert_grace_minutes, 30));
$$;

REVOKE ALL ON FUNCTION public.escalations_awaiting_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalations_awaiting_owner() TO service_role;

DROP FUNCTION IF EXISTS public.digest_for(UUID, DATE);

CREATE FUNCTION public.digest_for(p_org UUID, p_day DATE)
RETURNS TABLE (
    outlet_name TEXT, total INTEGER, completed INTEGER, finished_late INTEGER, missed INTEGER,
    raised INTEGER, raised_done INTEGER
)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
    SELECT o.name,
           COUNT(*) FILTER (WHERE t.raised_by_outlet_id IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE t.raised_by_outlet_id IS NULL AND a.status = 'completed')::INTEGER,
           COUNT(*) FILTER (
             WHERE t.raised_by_outlet_id IS NULL AND a.status = 'completed'
               AND a.completed_at > ((a.due_date + COALESCE(a.due_time,'23:59:59'::time))
                                     AT TIME ZONE COALESCE(org.timezone,'UTC'))
           )::INTEGER,
           COUNT(*) FILTER (WHERE t.raised_by_outlet_id IS NULL AND a.status <> 'completed')::INTEGER,
           COUNT(*) FILTER (WHERE t.raised_by_outlet_id IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE t.raised_by_outlet_id IS NOT NULL AND a.status = 'completed')::INTEGER
      FROM public.task_assignments a
      JOIN public.organizations org ON org.id = a.organization_id
      JOIN public.outlets o ON o.id = a.outlet_id
      JOIN public.tasks t ON t.id = a.task_id
     WHERE a.organization_id = p_org AND a.assigned_date = p_day
     GROUP BY o.name ORDER BY o.name;
$$;

REVOKE ALL ON FUNCTION public.digest_for(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.digest_for(UUID, DATE) TO authenticated, service_role;

COMMIT;

-- Verified against the live database as the branch: raising works and lands with the
-- deadline taken from the branch's own shift; an empty title, a shift the branch does
-- not run, an area it does not have, and blaming somebody from another branch's roster
-- are each refused by name. The owner calling it is refused too — it is a branch
-- action. Promotion to a standard is the owner's alone: the branch's attempt changed
-- no rows, since no policy grants it that update.
