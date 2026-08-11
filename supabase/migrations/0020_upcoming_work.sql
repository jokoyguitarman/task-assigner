-- 0020_upcoming_work
--
-- What is coming, before it arrives.
--
-- A recurring task is a rule, not a schedule. Nothing in the app projected those
-- rules forward, so there was no way to check that one had been set up correctly
-- until the day it fired. Create "every Monday" on a Tuesday and the honest answer
-- to "will that work?" was wait six days and see. For a tool whose whole purpose is
-- that the owner stops being the reminder system, that is the wrong answer.
--
-- Two sources, deliberately distinguished rather than merged:
--
--   Scheduled — a task_assignments row that already exists with a future date. Real,
--   claimable, and possibly already assigned to somebody.
--
--   Projected — a recurring rule that has not been materialised yet. Not a row
--   anywhere. It is what the hourly job will create when the day comes, worked out
--   here using the same qualification the job itself applies.
--
-- The distinction matters because a projection is a promise about the future, and
-- the future can change: retire the task, drop the area from a branch, close the
-- branch, and the projection quietly stops being true. Labelling them the same
-- would invite somebody to treat a projection as work that exists.
--
-- Starting from tomorrow rather than today. Today already has a screen — the board
-- — and duplicating it here would put the same job in two places with two different
-- meanings.
--
-- The qualification below is copied from materialise_recurring_tasks and has to stay
-- in step with it. Shared instead through a view would be nicer; it is duplicated
-- because the job inserts and this one only reads, and folding them together would
-- mean a read path that could write.

BEGIN;

CREATE OR REPLACE FUNCTION public.upcoming_work(p_days INTEGER DEFAULT 14)
RETURNS TABLE (
    business_day  DATE,
    outlet_id     UUID,
    outlet_name   TEXT,
    task_id       UUID,
    task_title    TEXT,
    area_name     TEXT,
    shift_name    TEXT,
    due_time      TIME,
    is_projected  BOOLEAN,
    assignment_id UUID,
    staff_name    TEXT,
    status        TEXT,
    recurrence    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
    v_org    UUID    := public.app_org_id();
    v_outlet UUID    := public.app_outlet_id();
    v_admin  BOOLEAN := public.app_is_admin();
    v_today  DATE;
    v_last   DATE;
BEGIN
    IF v_org IS NULL THEN
        RETURN;
    END IF;

    -- A branch sees its own, the owner sees the organization. Enforced here because
    -- the function is SECURITY DEFINER and therefore bypasses the policies that
    -- would otherwise say the same thing.
    IF NOT v_admin AND v_outlet IS NULL THEN
        RETURN;
    END IF;

    SELECT (NOW() AT TIME ZONE COALESCE(o.timezone, 'UTC'))::date
      INTO v_today
      FROM public.organizations o
     WHERE o.id = v_org;

    v_last := v_today + GREATEST(COALESCE(p_days, 14), 1);

    RETURN QUERY
    -- Already real.
    SELECT a.assigned_date,
           ou.id, ou.name,
           t.id, t.title,
           ar.name, s.name,
           a.due_time,
           FALSE,
           a.id,
           sp.name,
           a.status,
           CASE WHEN t.is_recurring THEN t.recurring_pattern ELSE 'once' END
      FROM public.task_assignments a
      JOIN public.tasks   t  ON t.id  = a.task_id
      JOIN public.outlets ou ON ou.id = a.outlet_id
      LEFT JOIN public.areas             ar ON ar.id = t.area_id
      LEFT JOIN public.shift_definitions s  ON s.id  = t.shift_id
      LEFT JOIN public.staff_profiles    sp ON sp.id = a.staff_id
     WHERE a.organization_id = v_org
       AND a.assigned_date > v_today
       AND a.assigned_date <= v_last
       AND (v_admin OR a.outlet_id = v_outlet)

    UNION ALL

    -- Not real yet. What the hourly job will make of the rules, day by day.
    SELECT d.day,
           ou.id, ou.name,
           t.id, t.title,
           ar.name, s.name,
           COALESCE(t.due_time_override, os.ends_at),
           TRUE,
           NULL::UUID,
           NULL::TEXT,
           'pending',
           t.recurring_pattern
      FROM public.tasks t
      CROSS JOIN LATERAL generate_series(v_today + 1, v_last, '1 day') AS g(day_ts)
      CROSS JOIN LATERAL (SELECT g.day_ts::date AS day) d
      JOIN public.outlets ou       ON ou.organization_id = v_org AND ou.is_active
      JOIN public.outlet_shifts os ON os.outlet_id = ou.id AND os.shift_id = t.shift_id
      JOIN public.outlet_areas oa  ON oa.outlet_id = ou.id AND oa.area_id  = t.area_id
      LEFT JOIN public.areas             ar ON ar.id = t.area_id
      LEFT JOIN public.shift_definitions s  ON s.id  = t.shift_id
     WHERE t.organization_id = v_org
       AND t.is_recurring
       AND (v_admin OR ou.id = v_outlet)
       AND (NOT EXISTS (SELECT 1 FROM public.task_outlets x WHERE x.task_id = t.id)
            OR EXISTS (SELECT 1 FROM public.task_outlets x
                        WHERE x.task_id = t.id AND x.outlet_id = ou.id))
       AND CASE t.recurring_pattern
             WHEN 'daily'  THEN TRUE
             WHEN 'weekly' THEN EXTRACT(DOW FROM d.day)::INT = t.recurring_weekday
             WHEN 'monthly' THEN EXTRACT(DAY FROM d.day)::INT = LEAST(
                    t.recurring_day_of_month,
                    EXTRACT(DAY FROM (date_trunc('month', d.day::timestamp)
                                      + INTERVAL '1 month - 1 day'))::INT)
             ELSE FALSE
           END
       -- Anything the job has already created shows up in the half above instead,
       -- so a day that has been materialised early is never listed twice.
       AND NOT EXISTS (
             SELECT 1 FROM public.task_assignments a2
              WHERE a2.task_id = t.id
                AND a2.outlet_id = ou.id
                AND a2.assigned_date = d.day)

    ORDER BY 1, 3, 8 NULLS LAST, 5;
END;
$fn$;

REVOKE ALL     ON FUNCTION public.upcoming_work(INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.upcoming_work(INTEGER) TO authenticated;

COMMIT;
