-- 0014_answers_and_photo_rules
--
-- Finishing a task could only ever mean one thing: somebody tapped a button. That is
-- enough for "did the bins go out" and useless for "how is the walk-in fridge", which
-- is the question an owner actually loses sleep over.
--
-- Four answer types, chosen per task. The condition scale is deliberately fixed rather
-- than defined per task: owner-written options would read better on the day and
-- aggregate into nothing, because a reading is only worth collecting if it can be
-- compared with the last thirty of the same kind.
--
-- Free text exists because not every kitchen owns a thermometer. Demanding a number
-- where none can be measured does not produce a measurement, it produces an invented
-- one - and a fabricated -18 is worse than an honest "felt cold, no frost", because it
-- carries false authority.

BEGIN;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS answer_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS answer_prompt TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS answer_min NUMERIC;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS answer_max NUMERIC;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requires_photo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_answer_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_answer_type_check
    CHECK (answer_type IN ('none','condition','text','number'));

ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS condition_rating TEXT;
ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS answer_text TEXT;
ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS answer_number NUMERIC;

ALTER TABLE public.task_assignments DROP CONSTRAINT IF EXISTS assignments_condition_check;
ALTER TABLE public.task_assignments ADD CONSTRAINT assignments_condition_check
    CHECK (condition_rating IS NULL OR condition_rating IN ('fine','attention','bad'));

-- ---------------------------------------------------------------------------
-- Enforcement
-- ---------------------------------------------------------------------------
--
-- Checked here rather than only in the completion screen, because the screen can be
-- bypassed by anything that can reach the API. A requirement that only the form knows
-- about is a suggestion, and a checkbox that reads like a rule but is not one is worse
-- than no checkbox at all.

CREATE OR REPLACE FUNCTION public.enforce_completion_requirements()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
    t        public.tasks%ROWTYPE;
    v_note   TEXT := NULLIF(btrim(COALESCE(NEW.completion_notes,'')), '');
    v_answer TEXT := NULLIF(btrim(COALESCE(NEW.answer_text,'')), '');
BEGIN
    IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO t FROM public.tasks WHERE id = NEW.task_id;

    IF t.requires_photo AND NOT EXISTS (
        SELECT 1 FROM public.task_completion_proofs p WHERE p.assignment_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'This one needs a photo before it can be marked done.';
    END IF;

    IF t.answer_type = 'condition' THEN
        IF NEW.condition_rating IS NULL THEN
            RAISE EXCEPTION 'Say what condition you found it in.';
        END IF;
        -- Fine needs no explanation. Anything else without a word about why is a dead
        -- end for whoever reads it later.
        IF NEW.condition_rating <> 'fine' AND v_note IS NULL THEN
            RAISE EXCEPTION 'Say briefly what was wrong.';
        END IF;
    END IF;

    IF t.answer_type = 'text' AND v_answer IS NULL THEN
        RAISE EXCEPTION 'This one needs an answer before it can be marked done.';
    END IF;

    IF t.answer_type = 'number' THEN
        IF NEW.answer_number IS NULL THEN
            RAISE EXCEPTION 'This one needs a reading before it can be marked done.';
        END IF;
        -- Out of range is allowed and recorded; it only has to be explained, so an
        -- unusual reading is never a bare number nobody can interpret later.
        IF ((t.answer_min IS NOT NULL AND NEW.answer_number < t.answer_min)
         OR (t.answer_max IS NOT NULL AND NEW.answer_number > t.answer_max))
           AND v_note IS NULL THEN
            RAISE EXCEPTION 'That reading is outside the expected range. Say what you found.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assignments_completion_requirements ON public.task_assignments;
CREATE TRIGGER assignments_completion_requirements
    BEFORE UPDATE ON public.task_assignments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_completion_requirements();

REVOKE ALL ON FUNCTION public.enforce_completion_requirements() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- Raised work carries the same choice
-- ---------------------------------------------------------------------------
--
-- The person who just looked at the problem decides whether the fix needs showing.
-- They are better placed than the owner two days later, and for branch-raised work it
-- matters more than usual: the branch raises it and the branch closes it, both from the
-- same shared phone, so the photo is the only outside check that exists.

DROP FUNCTION IF EXISTS public.raise_branch_task(TEXT, UUID, UUID, UUID, TEXT, TEXT);

CREATE FUNCTION public.raise_branch_task(
    p_title          TEXT,
    p_area_id        UUID,
    p_shift_id       UUID,
    p_staff_id       UUID DEFAULT NULL,
    p_note           TEXT DEFAULT NULL,
    p_photo_path     TEXT DEFAULT NULL,
    p_requires_photo BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
    v_outlet UUID := public.app_outlet_id();
    v_org    UUID := public.app_org_id();
    v_uid    UUID := auth.uid();
    v_starts TIME; v_ends TIME; v_today DATE;
    v_task UUID; v_assign UUID;
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
        photo_path, requires_photo, created_by
    ) VALUES (
        btrim(p_title), NULLIF(btrim(COALESCE(p_note,'')), ''), 15, false, false,
        p_shift_id, p_area_id, v_org, v_outlet, p_staff_id,
        p_photo_path, COALESCE(p_requires_photo, false), v_uid
    ) RETURNING id INTO v_task;

    INSERT INTO public.task_assignments (
        task_id, staff_id, outlet_id, organization_id, assigned_date, due_date, due_time, status
    ) VALUES (
        v_task, p_staff_id, v_outlet, v_org, v_today,
        v_today + CASE WHEN v_ends <= v_starts THEN 1 ELSE 0 END, v_ends, 'pending'
    ) RETURNING id INTO v_assign;

    INSERT INTO public.agent_actions (organization_id, actor_user_id, actor_role, source, operation, arguments)
    VALUES (v_org, v_uid, 'outlet', 'app', 'raise_branch_task',
            jsonb_build_object('task_id', v_task, 'assignment_id', v_assign, 'outlet_id', v_outlet));

    RETURN v_assign;
END;
$$;

REVOKE ALL ON FUNCTION public.raise_branch_task(TEXT, UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_branch_task(TEXT, UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- Looking at the readings
-- ---------------------------------------------------------------------------
--
-- A single reading says almost nothing. The same fridge coming back as Needs attention
-- five times in a month is the thing worth knowing, and it is countable only because
-- the scale is fixed.

CREATE OR REPLACE FUNCTION public.readings_history(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    task_title TEXT, outlet_name TEXT, area_name TEXT, answer_type TEXT,
    readings INTEGER, fine INTEGER, attention INTEGER, bad INTEGER,
    out_of_range INTEGER, last_seen DATE, last_value TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
    WITH answered AS (
        SELECT t.title, o.name AS outlet, ar.name AS area, t.answer_type,
               a.condition_rating, a.answer_number, a.answer_text, a.assigned_date,
               (t.answer_min IS NOT NULL AND a.answer_number < t.answer_min)
            OR (t.answer_max IS NOT NULL AND a.answer_number > t.answer_max) AS outside,
               ROW_NUMBER() OVER (PARTITION BY t.title, o.name ORDER BY a.assigned_date DESC) AS recency
          FROM public.task_assignments a
          JOIN public.tasks t   ON t.id = a.task_id
          JOIN public.outlets o ON o.id = a.outlet_id
          JOIN public.areas ar  ON ar.id = t.area_id
         WHERE a.organization_id = public.app_org_id()
           AND t.answer_type <> 'none'
           AND a.status = 'completed'
           AND a.assigned_date >= CURRENT_DATE - p_days
           AND (a.condition_rating IS NOT NULL OR a.answer_number IS NOT NULL OR a.answer_text IS NOT NULL)
    )
    SELECT title, outlet, area, answer_type,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE condition_rating = 'fine')::INTEGER,
           COUNT(*) FILTER (WHERE condition_rating = 'attention')::INTEGER,
           COUNT(*) FILTER (WHERE condition_rating = 'bad')::INTEGER,
           COUNT(*) FILTER (WHERE outside)::INTEGER,
           MAX(assigned_date),
           MAX(CASE WHEN recency = 1 THEN COALESCE(condition_rating, answer_number::text, answer_text) END)
      FROM answered
     GROUP BY title, outlet, area, answer_type
     ORDER BY COUNT(*) FILTER (WHERE condition_rating = 'bad') DESC,
              COUNT(*) FILTER (WHERE condition_rating = 'attention') DESC,
              title;
$$;

REVOKE ALL ON FUNCTION public.readings_history(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.readings_history(INTEGER) TO authenticated;

COMMIT;

-- Verified against the live database and rolled back. A task wanting a photo and a
-- condition refuses a bare tick, then refuses a photo with no rating, then refuses a
-- Bad with no explanation, then allows it once explained. A numeric task refuses a
-- missing reading, accepts one in range with no note, refuses one out of range
-- unexplained and accepts it explained. An ordinary task still completes with nothing
-- but a tick. Five days of ratings aggregate to "3 fine, 1 attention, 1 bad" with the
-- most recent value surfaced.
