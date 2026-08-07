-- 0006_branch_reassignment_with_reason
--
-- The guard added in 0003 forbade a branch from changing staff_id at all. That was
-- too blunt: the assignment form deliberately offers to leave the staff field
-- empty so "all available staff at the outlet can take this task", and the branch
-- dashboard has a Take Task flow for exactly that, so the pooled-task workflow on
-- the store phone was dead.
--
-- The rule now: a branch may assign and reassign within its own roster, but taking
-- work off someone who already owns it requires a reason, and every change of
-- ownership is recorded permanently.

BEGIN;

-- ---------------------------------------------------------------------------
-- The permanent record
-- ---------------------------------------------------------------------------
--
-- History lives in its own table rather than a column on the assignment, so a
-- second reassignment cannot overwrite the first one's reason. Clients cannot
-- insert, update or delete here at all: rows are written by the guard trigger,
-- which is why that function is now SECURITY DEFINER. An accountability trail
-- nobody can edit after the fact is the entire point.

CREATE TABLE IF NOT EXISTS public.assignment_reassignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    outlet_id       UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    from_staff_id   UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    to_staff_id     UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    reason          TEXT,
    reassigned_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reassigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reassignments_assignment ON public.assignment_reassignments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_reassignments_outlet     ON public.assignment_reassignments(outlet_id);

ALTER TABLE public.assignment_reassignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reassignments_admin_read ON public.assignment_reassignments;
CREATE POLICY reassignments_admin_read ON public.assignment_reassignments
    FOR SELECT TO authenticated
    USING (public.app_is_admin() AND organization_id = public.app_org_id());

DROP POLICY IF EXISTS reassignments_branch_read ON public.assignment_reassignments;
CREATE POLICY reassignments_branch_read ON public.assignment_reassignments
    FOR SELECT TO authenticated
    USING (public.app_is_outlet() AND outlet_id = public.app_outlet_id());

REVOKE ALL     ON public.assignment_reassignments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.assignment_reassignments FROM authenticated;
GRANT  SELECT  ON public.assignment_reassignments TO authenticated;

-- ---------------------------------------------------------------------------
-- How the reason arrives
-- ---------------------------------------------------------------------------
--
-- Write-only: the client sets it in the same update that changes staff_id, the
-- trigger copies it into the history table and then blanks it. Keeping it on the
-- row would create a loophole, because a PATCH that omits the column leaves the
-- previous value in NEW, which would let a stale reason satisfy a fresh
-- reassignment.

ALTER TABLE public.task_assignments
    ADD COLUMN IF NOT EXISTS reassignment_reason TEXT;

COMMENT ON COLUMN public.task_assignments.reassignment_reason IS
    'Write-only input. Send it alongside a staff_id change; the guard trigger '
    'moves it into assignment_reassignments and clears it. Always reads as NULL.';

-- ---------------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_branch_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_reason TEXT := NULLIF(btrim(COALESCE(NEW.reassignment_reason, '')), '');
BEGIN
    IF public.app_is_outlet() THEN
        -- What a branch may never touch. staff_id is no longer in this list.
        IF NEW.task_id                IS DISTINCT FROM OLD.task_id
        OR NEW.outlet_id              IS DISTINCT FROM OLD.outlet_id
        OR NEW.organization_id        IS DISTINCT FROM OLD.organization_id
        OR NEW.assigned_date          IS DISTINCT FROM OLD.assigned_date
        OR NEW.due_date               IS DISTINCT FROM OLD.due_date
        OR NEW.due_time               IS DISTINCT FROM OLD.due_time
        OR NEW.reschedule_approved_at IS DISTINCT FROM OLD.reschedule_approved_at
        OR NEW.reschedule_approved_by IS DISTINCT FROM OLD.reschedule_approved_by
        THEN
            RAISE EXCEPTION
                'A branch may record completion, take on work or request a reschedule, '
                'but may not change the deadline or approve its own reschedule.';
        END IF;

        IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
            -- Work stays inside the branch that owns it.
            IF NEW.staff_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.staff_profiles sp
                 WHERE sp.id = NEW.staff_id
                   AND sp.outlet_id = public.app_outlet_id()
            ) THEN
                RAISE EXCEPTION 'A branch may only assign work to people on its own roster.';
            END IF;

            -- Claiming unowned work is free. Taking it off someone is not.
            IF OLD.staff_id IS NOT NULL AND (v_reason IS NULL OR length(v_reason) < 5) THEN
                RAISE EXCEPTION
                    'Reassigning work that someone already owns needs a reason of at '
                    'least 5 characters.';
            END IF;
        END IF;
    END IF;

    -- Recorded for owner-initiated moves too, so the trail is complete. The owner
    -- is the authority here and is not required to justify themselves, so the
    -- reason may be null for their changes.
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

COMMIT;
