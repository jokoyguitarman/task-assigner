-- 0017_recurrence_anchor
--
-- Task.recurringPattern has always accepted 'weekly' and 'monthly', and neither has
-- ever produced a single assignment. materialise_recurring_tasks only ever matched
-- 'daily', for the reason 0007 gave when it made that choice:
--
--     Only 'daily' is materialised. Weekly and monthly patterns have no anchor date
--     in the schema, so there is nothing to say which day they land on; inventing one
--     would quietly create work on the wrong days.
--
-- Right call, and TaskForm went further by removing both options from its dropdown
-- rather than promising something the scheduler would not deliver. But that left the
-- capability missing rather than broken, and "every Monday" is an ordinary thing for
-- a restaurant owner to want. This stores the missing fact instead.
--
-- Note for whoever picks this up: TaskForm still offers Daily only, and the comment
-- there explaining why is now out of date. Re-enabling weekly and monthly needs a
-- weekday / day-of-month picker beside the pattern dropdown, or the insert will hit
-- the constraint below. The assistant already collects the anchor.
--
-- The anchor is a fixed property of the task rather than a rolling "next occurrence"
-- date. A cursor column would have to be advanced by whatever materialises it, and a
-- job that both reads and writes its own cursor is no longer idempotent — which is
-- the property the hourly cadence depends on, since every organization's midnight
-- arrives on a different run.
--
-- Nothing needed backfilling: verified before writing this, all five recurring tasks
-- in the database are daily, and no task of any kind is weekly or monthly.

BEGIN;

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS recurring_weekday      SMALLINT,
    ADD COLUMN IF NOT EXISTS recurring_day_of_month SMALLINT;

COMMENT ON COLUMN public.tasks.recurring_weekday IS
    'Which day a weekly task lands on. 0 = Sunday through 6 = Saturday, matching EXTRACT(DOW).';
COMMENT ON COLUMN public.tasks.recurring_day_of_month IS
    'Which day of the month a monthly task lands on. 29 to 31 fall on the last day of shorter months.';

-- Each pattern requires exactly the anchor it uses and forbids the other, so a task
-- cannot carry a weekday that nothing will ever read, and a weekly task cannot exist
-- without the one fact that makes it schedulable.
--
-- The COALESCE is load-bearing and was found by testing rather than by reading. A
-- CHECK rejects only FALSE, and passes on NULL. With the anchor missing — precisely
-- the case this constraint exists to catch — `recurring_weekday BETWEEN 0 AND 6`
-- evaluates to NULL rather than FALSE, so the first version of this accepted exactly
-- the row it was written to refuse.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_recurrence_anchor_check;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_recurrence_anchor_check CHECK (
        COALESCE(
            CASE
                WHEN is_recurring AND recurring_pattern = 'weekly' THEN
                    recurring_weekday BETWEEN 0 AND 6 AND recurring_day_of_month IS NULL
                WHEN is_recurring AND recurring_pattern = 'monthly' THEN
                    recurring_day_of_month BETWEEN 1 AND 31 AND recurring_weekday IS NULL
                ELSE
                    recurring_weekday IS NULL AND recurring_day_of_month IS NULL
            END,
            FALSE
        )
    );

-- ---------------------------------------------------------------------------
-- Materialisation
-- ---------------------------------------------------------------------------
--
-- Unchanged from the 0008 version except for the pattern test at the bottom: the
-- branch qualification (runs the shift, has the area, is targeted), the deadline
-- taken from the shift's end, and the past-midnight day offset all still apply
-- exactly as they do for daily work.
--
-- The 31st of a 30-day month lands on the 30th rather than being skipped. Skipping
-- would mean a task set for month-end silently missing February entirely, and a task
-- the owner set for the last day of the month is asking for the last day.

CREATE OR REPLACE FUNCTION public.materialise_recurring_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_created INTEGER := 0; r RECORD;
BEGIN
    FOR r IN
        SELECT t.id AS task_id,
               t.organization_id,
               ou.id AS outlet_id,
               d.business_day,
               COALESCE(t.due_time_override, os.ends_at) AS due_time,
               CASE WHEN t.due_time_override IS NULL AND os.ends_at <= os.starts_at THEN 1 ELSE 0 END AS day_offset
          FROM public.tasks t
          JOIN public.organizations o ON o.id = t.organization_id
          -- Worked out once, because the pattern test below needs the same calendar
          -- day the assignment will be stamped with.
          CROSS JOIN LATERAL (
              SELECT (NOW() AT TIME ZONE COALESCE(o.timezone, 'UTC'))::date AS business_day
          ) d
          JOIN public.outlets ou       ON ou.organization_id = t.organization_id AND ou.is_active = true
          JOIN public.outlet_shifts os ON os.outlet_id = ou.id AND os.shift_id = t.shift_id
          JOIN public.outlet_areas oa  ON oa.outlet_id = ou.id AND oa.area_id  = t.area_id
         WHERE t.is_recurring = true
           AND (NOT EXISTS (SELECT 1 FROM public.task_outlets x WHERE x.task_id = t.id)
                OR EXISTS (SELECT 1 FROM public.task_outlets x WHERE x.task_id = t.id AND x.outlet_id = ou.id))
           AND CASE t.recurring_pattern
                 WHEN 'daily'  THEN TRUE
                 WHEN 'weekly' THEN EXTRACT(DOW FROM d.business_day)::INT = t.recurring_weekday
                 WHEN 'monthly' THEN EXTRACT(DAY FROM d.business_day)::INT = LEAST(
                        t.recurring_day_of_month,
                        EXTRACT(DAY FROM (date_trunc('month', d.business_day::timestamp)
                                          + INTERVAL '1 month - 1 day'))::INT)
                 ELSE FALSE
               END
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.task_assignments a
             WHERE a.task_id = r.task_id AND a.outlet_id = r.outlet_id
               AND a.assigned_date = r.business_day
        ) THEN
            INSERT INTO public.task_assignments
                (task_id, staff_id, outlet_id, organization_id, assigned_date, due_date, due_time, status)
            VALUES
                (r.task_id, NULL, r.outlet_id, r.organization_id,
                 r.business_day, r.business_day + r.day_offset, r.due_time, 'pending');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    RETURN v_created;
END;
$fn$;

REVOKE ALL ON FUNCTION public.materialise_recurring_tasks() FROM PUBLIC, anon, authenticated;

COMMIT;
