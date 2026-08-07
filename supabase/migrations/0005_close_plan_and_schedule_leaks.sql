-- 0005_close_plan_and_schedule_leaks
--
-- Two findings from impersonating each principal in SQL after the hook was
-- registered. Neither was visible from reading the policy set, because both are
-- about what a policy cannot express.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. An owner could raise their own plan limits
-- ---------------------------------------------------------------------------
--
-- bootstrap_organization sets the tier and its limits itself, specifically so a
-- signup cannot award itself a higher plan. That was pointless: org_admin_update
-- lets the owner update their own organization row, and nothing narrowed which
-- columns, so `PATCH /organizations?id=eq.<own>` with max_employees = 9999
-- succeeded. Confirmed by impersonation, not inferred.
--
-- This is the same shape as the users.role escalation 0003 fixed, and it wants
-- the same answer: a policy chooses the row, a grant chooses the columns.
--
-- The owner keeps the two fields that are genuinely theirs. Plan changes belong
-- to whatever handles billing, which runs as service_role and bypasses this.

REVOKE UPDATE ON public.organizations FROM authenticated;
GRANT  UPDATE (name, timezone) ON public.organizations TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. A branch could read every schedule in the organization
-- ---------------------------------------------------------------------------
--
-- staff_profiles is scoped to the branch, but the schedule policies were scoped
-- to the organization, so a branch received all 16 monthly schedules when only 6
-- of the 8 roster members were its own. It leaked the shift pattern and days off
-- of other branches' staff, attached to staff_ids it could not resolve to names.
--
-- TeamScheduler iterates the roster and looks up each member's schedule, so it
-- never used the extra rows.
--
-- The subqueries are themselves subject to staff_profiles' own policies, which
-- narrow to the caller's branch anyway. Written explicitly so the intent does not
-- depend on that.

DROP POLICY IF EXISTS monthly_branch_read ON public.monthly_schedules;
CREATE POLICY monthly_branch_read ON public.monthly_schedules
    FOR SELECT TO authenticated
    USING (
        public.app_is_outlet()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.id = monthly_schedules.staff_id
              AND sp.outlet_id = public.app_outlet_id()
        )
    );

DROP POLICY IF EXISTS daily_branch_read ON public.daily_schedules;
CREATE POLICY daily_branch_read ON public.daily_schedules
    FOR SELECT TO authenticated
    USING (
        public.app_is_outlet()
        AND EXISTS (
            SELECT 1
            FROM public.monthly_schedules m
            JOIN public.staff_profiles sp ON sp.id = m.staff_id
            WHERE m.id = daily_schedules.monthly_schedule_id
              AND sp.outlet_id = public.app_outlet_id()
        )
    );

COMMIT;
