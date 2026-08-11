-- 0015_branch_roster_supersede_stale_proposal
--
-- Recovered from the live database on 2026-08-11. It was applied on 2026-08-10 as
-- `branch_roster_supersede_stale_proposal` without ever being committed, so a fresh
-- project rebuilt from this directory would have come up with the 0014 version of
-- set_branch_schedule and quietly lost the behaviour below.
--
-- What it adds: a pending request is withdrawn when the same day is settled another
-- way. Without it a branch could propose a far-off day, later set a nearer version of
-- that same day directly, and leave the owner holding a request that no longer matched
-- reality — approving it would have overwritten the newer answer with the stale one.
--
-- Two paths, both of which had to be closed:
--   Beyond the horizon, proposing again withdraws the previous request, so exactly one
--   is ever pending for a given person and day.
--   Inside the horizon, publishing directly withdraws any pending request for that day
--   and records why, so the owner sees it was superseded rather than ignored.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_branch_schedule(
    p_staff_id     UUID,
    p_date         DATE,
    p_is_day_off   BOOLEAN,
    p_time_in      TIME    DEFAULT NULL,
    p_time_out     TIME    DEFAULT NULL,
    p_day_off_type TEXT    DEFAULT NULL,
    p_reason       TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
    v_outlet UUID := public.app_outlet_id();
    v_org    UUID := public.app_org_id();
    v_uid    UUID := auth.uid();
    v_reason TEXT := NULLIF(btrim(COALESCE(p_reason,'')), '');
    v_today  DATE;
    v_horizon DATE;
    v_ms     UUID;
    v_old    public.daily_schedules%ROWTYPE;
    v_id     UUID;
BEGIN
    IF NOT public.app_is_outlet() OR v_outlet IS NULL THEN
        RAISE EXCEPTION 'Only a branch can keep its own roster';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.staff_profiles sp
         WHERE sp.id = p_staff_id AND sp.outlet_id = v_outlet
    ) THEN
        RAISE EXCEPTION 'That person is not on this branch roster';
    END IF;

    SELECT (NOW() AT TIME ZONE COALESCE(o.timezone,'UTC'))::date INTO v_today
      FROM public.organizations o WHERE o.id = v_org;

    v_horizon := v_today + 14;

    IF p_date < v_today THEN
        RAISE EXCEPTION 'That day has already been worked. Ask the owner to correct it.';
    END IF;

    IF p_is_day_off THEN
        IF p_day_off_type IS NULL OR p_day_off_type NOT IN ('vacation','sick','personal','other') THEN
            RAISE EXCEPTION 'Say what kind of day off: vacation, sick, personal or other';
        END IF;
    ELSE
        IF p_time_in IS NULL OR p_time_out IS NULL THEN
            RAISE EXCEPTION 'A working day needs a start time and an end time';
        END IF;
    END IF;

    IF p_date > v_horizon THEN
        UPDATE public.schedule_proposals
           SET status = 'withdrawn', decided_at = NOW(), decided_by = v_uid
         WHERE staff_id = p_staff_id AND schedule_date = p_date AND status = 'pending';

        INSERT INTO public.schedule_proposals (
            organization_id, outlet_id, staff_id, schedule_date,
            is_day_off, day_off_type, time_in, time_out, note, proposed_by
        ) VALUES (
            v_org, v_outlet, p_staff_id, p_date,
            p_is_day_off,
            CASE WHEN p_is_day_off THEN p_day_off_type ELSE NULL END,
            CASE WHEN p_is_day_off THEN NULL ELSE p_time_in END,
            CASE WHEN p_is_day_off THEN NULL ELSE p_time_out END,
            v_reason, v_uid
        )
        RETURNING id INTO v_id;

        INSERT INTO public.agent_actions (organization_id, actor_user_id, actor_role, source, operation, arguments)
        VALUES (v_org, v_uid, 'outlet', 'app', 'propose_branch_schedule',
                jsonb_build_object('proposal_id', v_id, 'staff_id', p_staff_id, 'date', p_date));

        RETURN jsonb_build_object('outcome', 'proposed', 'id', v_id);
    END IF;

    SELECT ms.id INTO v_ms
      FROM public.monthly_schedules ms
     WHERE ms.staff_id = p_staff_id
       AND ms.month = EXTRACT(MONTH FROM p_date)::INT
       AND ms.year  = EXTRACT(YEAR  FROM p_date)::INT;

    IF v_ms IS NOT NULL THEN
        SELECT * INTO v_old
          FROM public.daily_schedules
         WHERE monthly_schedule_id = v_ms AND schedule_date = p_date;
    END IF;

    IF v_old.id IS NOT NULL AND v_old.outlet_id IS NOT NULL AND v_old.outlet_id <> v_outlet THEN
        RAISE EXCEPTION 'The owner has this person at another branch that day.';
    END IF;

    IF v_old.id IS NOT NULL AND NOT v_old.is_day_off AND p_is_day_off
       AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RAISE EXCEPTION 'Taking somebody off a shift needs a reason of at least 5 characters.';
    END IF;

    UPDATE public.schedule_proposals
       SET status = 'withdrawn', decided_at = NOW(), decided_by = v_uid,
           decision_note = 'Superseded by the branch setting this day directly'
     WHERE staff_id = p_staff_id AND schedule_date = p_date AND status = 'pending';

    v_id := public.apply_schedule_day(
        v_org, v_outlet, p_staff_id, p_date,
        p_is_day_off, p_time_in, p_time_out, p_day_off_type,
        v_reason, v_uid, 'outlet'
    );

    RETURN jsonb_build_object('outcome', 'published', 'id', v_id);
END;
$fn$;

REVOKE ALL     ON FUNCTION public.set_branch_schedule(UUID, DATE, BOOLEAN, TIME, TIME, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_branch_schedule(UUID, DATE, BOOLEAN, TIME, TIME, TEXT, TEXT) TO authenticated;

COMMIT;
