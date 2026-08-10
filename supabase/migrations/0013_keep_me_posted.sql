-- 0013_keep_me_posted
--
-- Branch-raised work deliberately stays out of the alert path: if reporting a problem
-- could make the owner's phone ring, reporting becomes a way to set off alarms, and
-- the branch stops reporting. But that leaves no way to follow something that genuinely
-- matters.
--
-- The resolution is to move the choice to the owner. The branch may raise anything;
-- nothing reaches the owner unless the owner asked. Because the subscription belongs to
-- the owner, there is no path for a branch to trigger it — which is why both new columns
-- join the list the branch guard refuses.
--
-- It applies to any job, not only raised ones. There is nothing special about a raised
-- item here: an owner may equally want to follow a task they assigned themselves.

BEGIN;

ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS owner_watching BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS owner_completion_alerted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.task_assignments.owner_watching IS
    'The owner asked to be kept posted on this particular job. Owner-only: a branch '
    'setting it could force alerts on itself, which is what keeping raised work out of '
    'the alert path was meant to prevent.';

-- Watched work escalates whoever raised it. Everything else about escalation is
-- unchanged: still only past the grace window, still only once.
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
       AND (t.raised_by_outlet_id IS NULL OR a.owner_watching)
       AND NOW() >= ((a.due_date + COALESCE(a.due_time,'23:59:59'::time))
                     AT TIME ZONE COALESCE(org.timezone,'UTC'))
                    + make_interval(mins => COALESCE(org.owner_alert_grace_minutes, 30));
$$;

REVOKE ALL ON FUNCTION public.escalations_awaiting_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalations_awaiting_owner() TO service_role;

-- The other half of being kept posted: told when it was actually done, and by whom.
-- No grace window, because good news is not urgent but there is no reason to sit on it.
CREATE OR REPLACE FUNCTION public.completions_awaiting_owner()
RETURNS TABLE (id UUID, organization_id UUID, outlet_name TEXT, task_title TEXT,
               finished_by TEXT, was_late BOOLEAN)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
    SELECT a.id, a.organization_id, o.name, t.title,
           COALESCE(done.name, owner_of.name),
           a.completed_at > ((a.due_date + COALESCE(a.due_time,'23:59:59'::time))
                             AT TIME ZONE COALESCE(org.timezone,'UTC'))
      FROM public.task_assignments a
      JOIN public.organizations org ON org.id = a.organization_id
      JOIN public.outlets o ON o.id = a.outlet_id
      JOIN public.tasks t ON t.id = a.task_id
      LEFT JOIN public.staff_profiles done     ON done.id = a.completed_by_staff_id
      LEFT JOIN public.staff_profiles owner_of ON owner_of.id = a.staff_id
     WHERE a.owner_watching
       AND a.status = 'completed'
       AND a.completed_at IS NOT NULL
       AND a.owner_completion_alerted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.completions_awaiting_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.completions_awaiting_owner() TO service_role;

-- Deciding what the owner hears about is not a branch's business, so the subscription
-- and both alert marks join what the guard refuses.
CREATE OR REPLACE FUNCTION public.guard_branch_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_reason TEXT := NULLIF(btrim(COALESCE(NEW.reassignment_reason, '')), '');
BEGIN
    IF public.app_is_outlet() THEN
        IF NEW.task_id                     IS DISTINCT FROM OLD.task_id
        OR NEW.outlet_id                   IS DISTINCT FROM OLD.outlet_id
        OR NEW.organization_id             IS DISTINCT FROM OLD.organization_id
        OR NEW.assigned_date               IS DISTINCT FROM OLD.assigned_date
        OR NEW.due_date                    IS DISTINCT FROM OLD.due_date
        OR NEW.due_time                    IS DISTINCT FROM OLD.due_time
        OR NEW.reschedule_approved_at      IS DISTINCT FROM OLD.reschedule_approved_at
        OR NEW.reschedule_approved_by      IS DISTINCT FROM OLD.reschedule_approved_by
        OR NEW.owner_watching              IS DISTINCT FROM OLD.owner_watching
        OR NEW.owner_alerted_at            IS DISTINCT FROM OLD.owner_alerted_at
        OR NEW.owner_completion_alerted_at IS DISTINCT FROM OLD.owner_completion_alerted_at
        THEN
            RAISE EXCEPTION
                'A branch may record completion, take on work or request a reschedule, but may not change the deadline, approve its own reschedule, or decide what the owner is told about.';
        END IF;

        IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
            IF NEW.staff_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.staff_profiles sp
                 WHERE sp.id = NEW.staff_id AND sp.outlet_id = public.app_outlet_id()
            ) THEN
                RAISE EXCEPTION 'A branch may only assign work to people on its own roster.';
            END IF;

            IF OLD.staff_id IS NOT NULL AND (v_reason IS NULL OR length(v_reason) < 5) THEN
                RAISE EXCEPTION 'Reassigning work that someone already owns needs a reason of at least 5 characters.';
            END IF;
        END IF;
    END IF;

    IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
        INSERT INTO public.assignment_reassignments (
            assignment_id, organization_id, outlet_id,
            from_staff_id, to_staff_id, reason, reassigned_by
        ) VALUES (
            OLD.id, OLD.organization_id, OLD.outlet_id,
            OLD.staff_id, NEW.staff_id, v_reason, auth.uid()
        );
    END IF;

    NEW.reassignment_reason := NULL;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_branch_assignment_update() FROM PUBLIC, anon;

COMMIT;

-- Verified against the live database, rolled back afterwards. A raised item past its
-- deadline does not escalate; subscribing to it makes it escalate on the very next run,
-- which is what stops a late subscription silently missing the moment; finishing it
-- produces exactly one completion notice and stops the overdue nagging. Separately, a
-- branch attempting to set owner_watching or clear an alert mark is refused, while
-- recording its own completion still works.
