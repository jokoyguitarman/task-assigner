-- 0007_scheduled_jobs
--
-- Recurrence and the overdue sweep used to run in the browser, which meant the
-- system only kept time while somebody had the app open. A restaurant that closes
-- for the night, or a branch phone left locked, silently stopped the clock: no
-- tasks appeared the next morning and nothing became overdue.
--
-- All three jobs work in each organization's own timezone, not the server's, and
-- all three are idempotent so a retry or an overlapping run cannot double up.

BEGIN;

-- ---------------------------------------------------------------------------
-- Overdue sweep
-- ---------------------------------------------------------------------------
--
-- A task with a due time is late once that time passes; without one it is late at
-- the end of its day. The deadline is a wall-clock time in the restaurant, so it
-- is interpreted in the organization's timezone before being compared to now().

CREATE OR REPLACE FUNCTION public.sweep_overdue_assignments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.task_assignments a
       SET status = 'overdue',
           updated_at = NOW()
      FROM public.organizations o
     WHERE o.id = a.organization_id
       AND a.status = 'pending'
       AND (((a.due_date + COALESCE(a.due_time, '23:59:59'::time))
             AT TIME ZONE COALESCE(o.timezone, 'UTC')) < NOW());

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Recurrence
-- ---------------------------------------------------------------------------
--
-- A daily recurring task belongs to the organization, not to one branch, so every
-- active branch gets its own copy for its own local today. They are created
-- unassigned on purpose: whoever is on shift claims one from the branch phone,
-- which is what the Take Task flow is for.
--
-- Only 'daily' is materialised. Weekly and monthly patterns have no anchor date in
-- the schema, so there is nothing to say which day they land on; inventing one
-- would quietly create work on the wrong days.

CREATE OR REPLACE FUNCTION public.materialise_recurring_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_created INTEGER := 0;
    r RECORD;
BEGIN
    FOR r IN
        SELECT t.id AS task_id,
               t.organization_id,
               ou.id AS outlet_id,
               (NOW() AT TIME ZONE COALESCE(o.timezone, 'UTC'))::date AS local_today
          FROM public.tasks t
          JOIN public.organizations o ON o.id = t.organization_id
          JOIN public.outlets ou      ON ou.organization_id = t.organization_id
         WHERE t.is_recurring = true
           AND t.recurring_pattern = 'daily'
           AND ou.is_active = true
    LOOP
        -- Idempotent: the job runs hourly so that every timezone gets its own
        -- midnight, which means most runs must do nothing.
        IF NOT EXISTS (
            SELECT 1 FROM public.task_assignments a
             WHERE a.task_id = r.task_id
               AND a.outlet_id = r.outlet_id
               AND a.due_date = r.local_today
        ) THEN
            INSERT INTO public.task_assignments
                (task_id, staff_id, outlet_id, organization_id, assigned_date, due_date, status)
            VALUES
                (r.task_id, NULL, r.outlet_id, r.organization_id, r.local_today, r.local_today, 'pending');

            v_created := v_created + 1;
        END IF;
    END LOOP;

    RETURN v_created;
END;
$$;

-- ---------------------------------------------------------------------------
-- Streaks
-- ---------------------------------------------------------------------------
--
-- Nothing ever wrote these, so every streak on every dashboard was zero.
--
-- A day counts only if the person had work due that day and finished all of it.
-- Completing one task while leaving another unfinished is not a clear day, which
-- is the whole point of the number. The streak may end on today or on yesterday:
-- a shift still in progress should not reset it to zero every morning.

CREATE OR REPLACE FUNCTION public.recalculate_streaks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_updated INTEGER := 0;
    s RECORD;
    v_today DATE;
    v_cursor DATE;
    v_streak INTEGER;
    v_last_clear DATE;
    v_clear BOOLEAN;
BEGIN
    FOR s IN
        SELECT sp.id,
               sp.longest_streak,
               (NOW() AT TIME ZONE COALESCE(o.timezone, 'UTC'))::date AS local_today
          FROM public.staff_profiles sp
          JOIN public.organizations o ON o.id = sp.organization_id
         WHERE sp.is_active = true
    LOOP
        v_today := s.local_today;
        v_streak := 0;
        v_last_clear := NULL;

        SELECT EXISTS (
            SELECT 1 FROM public.task_assignments a
             WHERE a.staff_id = s.id AND a.due_date = v_today
        ) AND NOT EXISTS (
            SELECT 1 FROM public.task_assignments a
             WHERE a.staff_id = s.id AND a.due_date = v_today AND a.status <> 'completed'
        ) INTO v_clear;

        v_cursor := CASE WHEN v_clear THEN v_today ELSE v_today - 1 END;

        LOOP
            SELECT EXISTS (
                SELECT 1 FROM public.task_assignments a
                 WHERE a.staff_id = s.id AND a.due_date = v_cursor
            ) AND NOT EXISTS (
                SELECT 1 FROM public.task_assignments a
                 WHERE a.staff_id = s.id AND a.due_date = v_cursor AND a.status <> 'completed'
            ) INTO v_clear;

            EXIT WHEN NOT v_clear;

            v_streak := v_streak + 1;
            IF v_last_clear IS NULL THEN
                v_last_clear := v_cursor;
            END IF;
            v_cursor := v_cursor - 1;

            -- A guard against walking back through years of history.
            EXIT WHEN v_streak >= 400;
        END LOOP;

        UPDATE public.staff_profiles
           SET current_streak = v_streak,
               longest_streak = GREATEST(COALESCE(longest_streak, 0), v_streak),
               last_clear_board_date = COALESCE(v_last_clear, last_clear_board_date)
         WHERE id = s.id
           AND (current_streak IS DISTINCT FROM v_streak
                OR longest_streak IS DISTINCT FROM GREATEST(COALESCE(longest_streak, 0), v_streak)
                OR last_clear_board_date IS DISTINCT FROM COALESCE(v_last_clear, last_clear_board_date));

        IF FOUND THEN
            v_updated := v_updated + 1;
        END IF;
    END LOOP;

    RETURN v_updated;
END;
$$;

-- These run from cron as the database owner. No client has any business calling
-- them, and they are SECURITY DEFINER, so nobody gets the chance.
REVOKE ALL ON FUNCTION public.sweep_overdue_assignments()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.materialise_recurring_tasks() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_streaks()         FROM PUBLIC, anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
--
-- cron runs in UTC. The hourly cadence is what lets each organization get its own
-- local midnight without a job per timezone, and is affordable because every job
-- is a no-op once its work for the day is done.

SELECT cron.schedule('sweep-overdue',        '*/15 * * * *', $$SELECT public.sweep_overdue_assignments();$$);
SELECT cron.schedule('materialise-recurring', '7 * * * *',   $$SELECT public.materialise_recurring_tasks();$$);
SELECT cron.schedule('recalculate-streaks',  '23 * * * *',   $$SELECT public.recalculate_streaks();$$);
