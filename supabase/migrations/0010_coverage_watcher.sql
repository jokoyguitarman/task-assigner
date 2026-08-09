-- 0010_coverage_watcher
--
-- The case that started the whole idea: a task is owned by a name, that person is
-- on leave, and nobody notices until the job is already missed. Catching it a day
-- early is the difference between a decision and a post-mortem.
--
-- No language model involved. Everything needed is already recorded - assignments
-- carry a staff member, and daily_schedules records days off and which branch
-- somebody is working at.

BEGIN;

-- Two things count as a gap: the person is on a day off, or they are rostered at a
-- different branch that day and so cannot do work here.
--
-- A missing roster entry is deliberately NOT a gap. Not knowing where somebody is
-- differs from knowing they are away, and treating silence as absence would cry
-- wolf on every branch that has not filled in a schedule - which is most of them.
--
-- Looks one day ahead as well as at today, because a warning is only useful while
-- there is still time to act on it.
CREATE OR REPLACE FUNCTION public.coverage_gaps_for(p_org UUID)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    outlet_name TEXT,
    task_title TEXT,
    staff_name TEXT,
    business_day DATE,
    due_time TIME,
    reason TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
    SELECT a.id, a.organization_id, o.name, t.title, sp.name, a.assigned_date, a.due_time,
           CASE WHEN ds.is_day_off THEN 'on a day off'
                ELSE 'rostered at ' || COALESCE(other.name, 'another branch') END
      FROM public.task_assignments a
      JOIN public.organizations org ON org.id = a.organization_id
      JOIN public.outlets o  ON o.id = a.outlet_id
      JOIN public.tasks t    ON t.id = a.task_id
      JOIN public.staff_profiles sp ON sp.id = a.staff_id
      JOIN public.monthly_schedules ms
        ON ms.staff_id = a.staff_id
       AND ms.month = EXTRACT(MONTH FROM a.assigned_date)
       AND ms.year  = EXTRACT(YEAR  FROM a.assigned_date)
      JOIN public.daily_schedules ds
        ON ds.monthly_schedule_id = ms.id
       AND ds.schedule_date = a.assigned_date
      LEFT JOIN public.outlets other ON other.id = ds.outlet_id
     WHERE a.organization_id = p_org
       AND a.status <> 'completed'
       AND a.assigned_date BETWEEN (NOW() AT TIME ZONE COALESCE(org.timezone,'UTC'))::date
                               AND (NOW() AT TIME ZONE COALESCE(org.timezone,'UTC'))::date + 1
       AND (ds.is_day_off = true OR (ds.outlet_id IS NOT NULL AND ds.outlet_id <> a.outlet_id))
     ORDER BY a.assigned_date, a.due_time NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.coverage_gaps_for(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coverage_gaps_for(UUID) TO service_role;

-- What the app calls. Scoped to the caller's own organization, so the wrapper
-- cannot be used to look into somebody else's.
CREATE OR REPLACE FUNCTION public.coverage_gaps()
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    outlet_name TEXT,
    task_title TEXT,
    staff_name TEXT,
    business_day DATE,
    due_time TIME,
    reason TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT * FROM public.coverage_gaps_for(public.app_org_id()); $$;

REVOKE ALL ON FUNCTION public.coverage_gaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coverage_gaps() TO authenticated;

COMMIT;

-- Verified against the live database by assigning a Mabini job to somebody on the
-- Mabini roster and then, in a transaction that was rolled back, booking them off:
-- "Arlene is on a day off". Rostering them at the other branch instead produced
-- "Arlene is rostered at Cucina Abz". A staff member with no roster row for the day
-- correctly produced nothing.
