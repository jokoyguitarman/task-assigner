-- 0014_branch_keeps_the_roster
--
-- The roster in this database stopped on 2025-09-13 and was never touched again.
-- Fifteen days were filled in, then nothing for eleven months. That is not neglect,
-- it is the predictable result of routing every sick call and shift swap through the
-- one person who is not in the building: schedules were owner-write-only, so keeping
-- them current cost the owner a phone call per change and they stopped paying it.
--
-- The cost is not merely a stale table. coverage_gaps() inner-joins daily_schedules
-- and deliberately treats a missing row as "not a gap", so with an empty roster the
-- coverage watcher - the case 0010 calls the one that started the whole idea - has
-- been silently returning nothing.
--
-- So the branch keeps its own roster, on the pattern 0012 settled on: not permission,
-- but attribution. Two windows, because the two kinds of change are not alike:
--
--   today .. +14 days   published immediately. This is where the bottleneck bites -
--                       somebody is off sick now and the cover is standing there.
--   beyond +14 days     proposed, and the owner publishes it. Long-range planning is
--                       the owner's to shape, and an approval queue here cannot block
--                       operations the way 0012 warned, because nothing in that window
--                       is urgent by definition.
--
-- The past stays owner-only throughout. It is payroll by then.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The permanent record
-- ---------------------------------------------------------------------------
--
-- Every published change, whoever made it, with what it was beside what it became.
-- Clients cannot insert, update or delete here at all - rows arrive only through the
-- functions below, which is why those are SECURITY DEFINER. A trail the audited party
-- can edit afterwards is not a trail.

CREATE TABLE IF NOT EXISTS public.schedule_changes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    outlet_id       UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    staff_id        UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    schedule_date   DATE NOT NULL,
    was             JSONB,
    became          JSONB NOT NULL,
    reason          TEXT,
    changed_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    changed_role    TEXT NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_changes_org    ON public.schedule_changes(organization_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_outlet ON public.schedule_changes(outlet_id, changed_at DESC);

COMMENT ON COLUMN public.schedule_changes.was IS
    'Null when the day had no roster entry before this change.';

ALTER TABLE public.schedule_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_changes_admin_read ON public.schedule_changes;
CREATE POLICY schedule_changes_admin_read ON public.schedule_changes
    FOR SELECT TO authenticated
    USING (public.app_is_admin() AND organization_id = public.app_org_id());

DROP POLICY IF EXISTS schedule_changes_branch_read ON public.schedule_changes;
CREATE POLICY schedule_changes_branch_read ON public.schedule_changes
    FOR SELECT TO authenticated
    USING (public.app_is_outlet() AND outlet_id = public.app_outlet_id());

REVOKE ALL ON public.schedule_changes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.schedule_changes FROM authenticated;
GRANT  SELECT ON public.schedule_changes TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. What the branch is asking for
-- ---------------------------------------------------------------------------
--
-- Deliberately a separate table rather than a status column on daily_schedules. A
-- proposal must not be visible to anything that reads the roster as fact - the
-- coverage watcher, the nightly assignment job - until the owner publishes it.
-- Keeping it out of daily_schedules makes that true by construction instead of by
-- everyone remembering to filter.

CREATE TABLE IF NOT EXISTS public.schedule_proposals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    outlet_id       UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    staff_id        UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    schedule_date   DATE NOT NULL,
    is_day_off      BOOLEAN NOT NULL DEFAULT FALSE,
    day_off_type    TEXT,
    time_in         TIME,
    time_out        TIME,
    note            TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    proposed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    proposed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    decided_at      TIMESTAMPTZ,
    decision_note   TEXT,

    CONSTRAINT schedule_proposals_status_check
        CHECK (status IN ('pending','approved','rejected','withdrawn')),

    -- The same shape daily_schedules enforces, checked here so a proposal cannot be
    -- approved into a row the target table would reject.
    CONSTRAINT schedule_proposals_shape_check CHECK (
        (is_day_off AND time_in IS NULL AND time_out IS NULL)
        OR
        (NOT is_day_off AND time_in IS NOT NULL AND time_out IS NOT NULL AND day_off_type IS NULL)
    ),

    CONSTRAINT schedule_proposals_day_off_type_check
        CHECK (day_off_type IS NULL OR day_off_type IN ('vacation','sick','personal','other'))
);

-- One open request per person per day. Without this a branch could stack fifty
-- proposals for the same date and the owner would have to decline them one by one.
-- Partial, so the settled history of that day is kept.
CREATE UNIQUE INDEX IF NOT EXISTS schedule_proposals_one_pending
    ON public.schedule_proposals (staff_id, schedule_date)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_schedule_proposals_pending
    ON public.schedule_proposals (organization_id, schedule_date)
    WHERE status = 'pending';

ALTER TABLE public.schedule_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_proposals_admin_read ON public.schedule_proposals;
CREATE POLICY schedule_proposals_admin_read ON public.schedule_proposals
    FOR SELECT TO authenticated
    USING (public.app_is_admin() AND organization_id = public.app_org_id());

DROP POLICY IF EXISTS schedule_proposals_branch_read ON public.schedule_proposals;
CREATE POLICY schedule_proposals_branch_read ON public.schedule_proposals
    FOR SELECT TO authenticated
    USING (public.app_is_outlet() AND outlet_id = public.app_outlet_id());

-- Reading only. Raising and deciding both go through functions, because the values
-- that matter - which outlet, which window, who decided - must be derived rather
-- than accepted from the caller.
REVOKE ALL ON public.schedule_proposals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.schedule_proposals FROM authenticated;
GRANT  SELECT ON public.schedule_proposals TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Writing a day, once
-- ---------------------------------------------------------------------------
--
-- Shared by the branch's direct edit and the owner's approval, so the two paths
-- cannot drift apart. Not callable from outside: every grant is revoked, and the
-- definer functions below reach it as their owner.
--
-- It takes the actor as parameters rather than reading the JWT, because when the
-- owner approves a proposal the outlet being written is the branch's, not theirs.

CREATE OR REPLACE FUNCTION public.apply_schedule_day(
    p_org          UUID,
    p_outlet       UUID,
    p_staff        UUID,
    p_date         DATE,
    p_is_day_off   BOOLEAN,
    p_time_in      TIME,
    p_time_out     TIME,
    p_day_off_type TEXT,
    p_reason       TEXT,
    p_actor        UUID,
    p_actor_role   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
    v_ms  UUID;
    v_old public.daily_schedules%ROWTYPE;
    v_row public.daily_schedules%ROWTYPE;
BEGIN
    -- The month row the day hangs from, created on demand. DO UPDATE rather than
    -- DO NOTHING because only the former returns a row to RETURNING; the assignment
    -- is a deliberate no-op.
    INSERT INTO public.monthly_schedules (staff_id, month, year, organization_id, created_by)
    VALUES (p_staff,
            EXTRACT(MONTH FROM p_date)::INT,
            EXTRACT(YEAR  FROM p_date)::INT,
            p_org, p_actor)
    ON CONFLICT (staff_id, month, year) DO UPDATE SET staff_id = EXCLUDED.staff_id
    RETURNING id INTO v_ms;

    SELECT * INTO v_old
      FROM public.daily_schedules
     WHERE monthly_schedule_id = v_ms AND schedule_date = p_date;

    -- The CASE arms make the two shapes mutually exclusive here rather than relying
    -- on daily_schedules_shift_check to complain: a caller sending both a day off and
    -- a start time gets the time dropped instead of a constraint violation.
    INSERT INTO public.daily_schedules (
        monthly_schedule_id, schedule_date, outlet_id, organization_id,
        time_in, time_out, is_day_off, day_off_type, notes
    ) VALUES (
        v_ms, p_date,
        CASE WHEN p_is_day_off THEN NULL ELSE p_outlet END,
        p_org,
        CASE WHEN p_is_day_off THEN NULL ELSE p_time_in END,
        CASE WHEN p_is_day_off THEN NULL ELSE p_time_out END,
        p_is_day_off,
        CASE WHEN p_is_day_off THEN p_day_off_type ELSE NULL END,
        p_reason
    )
    ON CONFLICT (monthly_schedule_id, schedule_date) DO UPDATE SET
        outlet_id    = EXCLUDED.outlet_id,
        time_in      = EXCLUDED.time_in,
        time_out     = EXCLUDED.time_out,
        is_day_off   = EXCLUDED.is_day_off,
        day_off_type = EXCLUDED.day_off_type,
        notes        = EXCLUDED.notes
    RETURNING * INTO v_row;

    INSERT INTO public.schedule_changes (
        organization_id, outlet_id, staff_id, schedule_date,
        was, became, reason, changed_by, changed_role
    ) VALUES (
        p_org, p_outlet, p_staff, p_date,
        CASE WHEN v_old.id IS NULL THEN NULL ELSE jsonb_build_object(
            'is_day_off',   v_old.is_day_off,
            'day_off_type', v_old.day_off_type,
            'time_in',      v_old.time_in,
            'time_out',     v_old.time_out,
            'outlet_id',    v_old.outlet_id) END,
        jsonb_build_object(
            'is_day_off',   v_row.is_day_off,
            'day_off_type', v_row.day_off_type,
            'time_in',      v_row.time_in,
            'time_out',     v_row.time_out,
            'outlet_id',    v_row.outlet_id),
        NULLIF(btrim(COALESCE(p_reason,'')), ''),
        p_actor, p_actor_role
    );

    RETURN v_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_schedule_day(UUID, UUID, UUID, DATE, BOOLEAN, TIME, TIME, TEXT, TEXT, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The branch setting a day
-- ---------------------------------------------------------------------------
--
-- One call whichever window the date falls in; the function decides whether that
-- means publishing or proposing and says which it did. The client does not compute
-- the boundary, so it cannot be argued with by editing a request.

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
AS $$
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

    -- Identity comes from the token, never from an argument: a branch cannot name a
    -- different outlet and cannot roster somebody who is not its own.
    IF NOT EXISTS (
        SELECT 1 FROM public.staff_profiles sp
         WHERE sp.id = p_staff_id AND sp.outlet_id = v_outlet
    ) THEN
        RAISE EXCEPTION 'That person is not on this branch roster';
    END IF;

    -- The organization's today, not the server's, matching how 0012 and the nightly
    -- jobs decide what day it is.
    SELECT (NOW() AT TIME ZONE COALESCE(o.timezone,'UTC'))::date INTO v_today
      FROM public.organizations o WHERE o.id = v_org;

    v_horizon := v_today + 14;

    IF p_date < v_today THEN
        RAISE EXCEPTION 'That day has already been worked. Ask the owner to correct it.';
    END IF;

    -- Checked before the constraints would, so the phone shows a sentence rather than
    -- a constraint name.
    IF p_is_day_off THEN
        IF p_day_off_type IS NULL OR p_day_off_type NOT IN ('vacation','sick','personal','other') THEN
            RAISE EXCEPTION 'Say what kind of day off: vacation, sick, personal or other';
        END IF;
    ELSE
        IF p_time_in IS NULL OR p_time_out IS NULL THEN
            RAISE EXCEPTION 'A working day needs a start time and an end time';
        END IF;
    END IF;

    -- Beyond the horizon this is a request, not a change. Nothing reaches
    -- daily_schedules, so the roster everything else reads stays the owner's.
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

    -- Inside the horizon. What is already there decides whether this is allowed.
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

    -- Somebody lent to another branch for the day is not this branch's to reclaim.
    -- staff_profiles.outlet_id is only where they are based.
    IF v_old.id IS NOT NULL AND v_old.outlet_id IS NOT NULL AND v_old.outlet_id <> v_outlet THEN
        RAISE EXCEPTION 'The owner has this person at another branch that day.';
    END IF;

    -- The asymmetry 0006 established for reassignment: putting somebody on is free,
    -- taking them off a shift they already had is not.
    IF v_old.id IS NOT NULL AND NOT v_old.is_day_off AND p_is_day_off
       AND (v_reason IS NULL OR length(v_reason) < 5) THEN
        RAISE EXCEPTION 'Taking somebody off a shift needs a reason of at least 5 characters.';
    END IF;

    -- A day proposed while it was still distant becomes publishable as it draws
    -- near. Without this the stale request outlives the branch's own newer edit and
    -- the owner approving it weeks later would silently overwrite them.
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
$$;

REVOKE ALL     ON FUNCTION public.set_branch_schedule(UUID, DATE, BOOLEAN, TIME, TIME, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_branch_schedule(UUID, DATE, BOOLEAN, TIME, TIME, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. The owner deciding
-- ---------------------------------------------------------------------------
--
-- Approving publishes the proposed day through the same path a branch's direct edit
-- takes, so an approved request and a near-term change land identically.

CREATE OR REPLACE FUNCTION public.decide_schedule_proposal(
    p_proposal_id UUID,
    p_approve     BOOLEAN,
    p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
    v_org  UUID := public.app_org_id();
    v_uid  UUID := auth.uid();
    v_note TEXT := NULLIF(btrim(COALESCE(p_note,'')), '');
    v_p    public.schedule_proposals%ROWTYPE;
    v_id   UUID;
BEGIN
    IF NOT public.app_is_admin() THEN
        RAISE EXCEPTION 'Only the owner can publish a roster request';
    END IF;

    SELECT * INTO v_p
      FROM public.schedule_proposals
     WHERE id = p_proposal_id AND organization_id = v_org
     FOR UPDATE;

    IF v_p.id IS NULL THEN
        RAISE EXCEPTION 'No such request';
    END IF;

    IF v_p.status <> 'pending' THEN
        RAISE EXCEPTION 'That request was already settled';
    END IF;

    UPDATE public.schedule_proposals
       SET status        = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
           decided_by    = v_uid,
           decided_at    = NOW(),
           decision_note = v_note
     WHERE id = v_p.id;

    IF NOT p_approve THEN
        RETURN jsonb_build_object('outcome', 'rejected', 'id', v_p.id);
    END IF;

    -- 'admin' is recorded as the actor: the owner is who published it. Who asked is
    -- kept on the proposal itself.
    v_id := public.apply_schedule_day(
        v_p.organization_id, v_p.outlet_id, v_p.staff_id, v_p.schedule_date,
        v_p.is_day_off, v_p.time_in, v_p.time_out, v_p.day_off_type,
        COALESCE(v_note, v_p.note), v_uid, 'admin'
    );

    INSERT INTO public.agent_actions (organization_id, actor_user_id, actor_role, source, operation, arguments)
    VALUES (v_org, v_uid, 'admin', 'app', 'decide_schedule_proposal',
            jsonb_build_object('proposal_id', v_p.id, 'approved', true, 'daily_schedule_id', v_id));

    RETURN jsonb_build_object('outcome', 'approved', 'id', v_id);
END;
$$;

REVOKE ALL     ON FUNCTION public.decide_schedule_proposal(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decide_schedule_proposal(UUID, BOOLEAN, TEXT) TO authenticated;

COMMIT;

-- Verified against the live database as the Mabini branch, in transactions that were
-- rolled back. Tomorrow's shift published immediately; the same edit thirty days out
-- came back as a proposal and left daily_schedules untouched until the owner approved
-- it, at which point the day appeared. Refused by name: a day already worked, somebody
-- on another branch's roster, clearing a shift without a reason, a day off with no
-- type, and the branch approving its own request. The branch's direct INSERT into
-- daily_schedules is still refused by RLS, and its UPDATE against schedule_changes
-- touched no rows. Deciding a settled request twice is refused. The trail chains as
-- intended: 08:00-17:00 out of nothing, then 10:00-19:00 "covering the late shift",
-- then a personal day "family emergency came up", each row carrying the state before
-- it beside the state after.
--
-- Superseding was checked separately, since it is the case that is easy to get wrong:
-- proposing the same day twice leaves exactly one request pending, the owner publishes
-- the later of the two rather than the stale one, and the withdrawn request cannot
-- then be approved on top of it.
