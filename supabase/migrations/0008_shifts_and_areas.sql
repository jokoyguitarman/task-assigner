-- 0008_shifts_and_areas
--
-- Until now nothing said what time a task was due. The recurrence job added in
-- 0007 created each day's work with no due_time at all, so a closing task was
-- only late at midnight and an opening task was not late all day. That single
-- gap blocked lateness, on-time rates, escalation and any red/green view.
--
-- The model splits vocabulary from reality. The business names its shifts and
-- areas once; each branch declares which of them it actually has, and at what
-- times. A task references a shift and an area by name and only materialises at
-- branches that have both, so a 24-hour branch never receives closing work and a
-- branch with no counter never receives counter work, with no special case
-- anywhere in the code.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The vocabulary, owned by the business
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shift_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.areas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

-- ---------------------------------------------------------------------------
-- 2. What each branch actually has
-- ---------------------------------------------------------------------------
--
-- ends_at <= starts_at means the shift crosses midnight. That is not an error to
-- reject: a closing shift running 22:00 to 02:00 is ordinary, and the deadline
-- simply falls on the following day. Storing it plainly and deriving the
-- rollover once, in the job, keeps the rule in a single place.

CREATE TABLE IF NOT EXISTS public.outlet_shifts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id  UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    shift_id   UUID NOT NULL REFERENCES public.shift_definitions(id) ON DELETE CASCADE,
    starts_at  TIME NOT NULL,
    ends_at    TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (outlet_id, shift_id)
);

CREATE TABLE IF NOT EXISTS public.outlet_areas (
    outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    area_id   UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
    PRIMARY KEY (outlet_id, area_id)
);

-- ---------------------------------------------------------------------------
-- 3. Optional per-task branch targeting
-- ---------------------------------------------------------------------------
--
-- No rows means every qualifying branch. Shift and area already do most of the
-- filtering, so this exists only for the genuinely uneven case.

CREATE TABLE IF NOT EXISTS public.task_outlets (
    task_id   UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_definitions_org ON public.shift_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_areas_org             ON public.areas(organization_id);
CREATE INDEX IF NOT EXISTS idx_outlet_shifts_outlet  ON public.outlet_shifts(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_areas_outlet   ON public.outlet_areas(outlet_id);
CREATE INDEX IF NOT EXISTS idx_task_outlets_task     ON public.task_outlets(task_id);

-- ---------------------------------------------------------------------------
-- 4. Task and organization columns
-- ---------------------------------------------------------------------------
--
-- Added nullable so existing rows survive; made NOT NULL after the backfill
-- further down.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS shift_id          UUID REFERENCES public.shift_definitions(id) ON DELETE RESTRICT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS area_id           UUID REFERENCES public.areas(id) ON DELETE RESTRICT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time_override TIME;

COMMENT ON COLUMN public.tasks.due_time_override IS
    'When set, this exact time wins at every branch. Otherwise the deadline is '
    'the end of the task shift at each branch, which differs per location.';

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS owner_alert_grace_minutes INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.organizations.owner_alert_grace_minutes IS
    'How long past a deadline before the owner is told. The branch sees work go '
    'late immediately; this delay is what stops the owner being interrupted for '
    'something finished five minutes over.';

-- ---------------------------------------------------------------------------
-- 5. Row-level security
-- ---------------------------------------------------------------------------
--
-- Reads are organization-wide: a branch needs to know the vocabulary to render
-- its own checklists, and none of it is sensitive. Writes are the owner's alone,
-- because these definitions decide when work is late everywhere.

ALTER TABLE public.shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_shifts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_areas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_outlets      ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_read ON public.shift_definitions FOR SELECT TO authenticated
    USING (organization_id = public.app_org_id());
CREATE POLICY shifts_admin_write ON public.shift_definitions FOR ALL TO authenticated
    USING (public.app_is_admin() AND organization_id = public.app_org_id())
    WITH CHECK (public.app_is_admin() AND organization_id = public.app_org_id());

CREATE POLICY areas_read ON public.areas FOR SELECT TO authenticated
    USING (organization_id = public.app_org_id());
CREATE POLICY areas_admin_write ON public.areas FOR ALL TO authenticated
    USING (public.app_is_admin() AND organization_id = public.app_org_id())
    WITH CHECK (public.app_is_admin() AND organization_id = public.app_org_id());

CREATE POLICY outlet_shifts_read ON public.outlet_shifts FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.outlets o WHERE o.id = outlet_shifts.outlet_id AND o.organization_id = public.app_org_id()));
CREATE POLICY outlet_shifts_admin_write ON public.outlet_shifts FOR ALL TO authenticated
    USING (public.app_is_admin() AND EXISTS (SELECT 1 FROM public.outlets o WHERE o.id = outlet_shifts.outlet_id AND o.organization_id = public.app_org_id()))
    WITH CHECK (public.app_is_admin() AND EXISTS (SELECT 1 FROM public.outlets o WHERE o.id = outlet_shifts.outlet_id AND o.organization_id = public.app_org_id()));

CREATE POLICY outlet_areas_read ON public.outlet_areas FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.outlets o WHERE o.id = outlet_areas.outlet_id AND o.organization_id = public.app_org_id()));
CREATE POLICY outlet_areas_admin_write ON public.outlet_areas FOR ALL TO authenticated
    USING (public.app_is_admin() AND EXISTS (SELECT 1 FROM public.outlets o WHERE o.id = outlet_areas.outlet_id AND o.organization_id = public.app_org_id()))
    WITH CHECK (public.app_is_admin() AND EXISTS (SELECT 1 FROM public.outlets o WHERE o.id = outlet_areas.outlet_id AND o.organization_id = public.app_org_id()));

CREATE POLICY task_outlets_read ON public.task_outlets FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_outlets.task_id AND t.organization_id = public.app_org_id()));
CREATE POLICY task_outlets_admin_write ON public.task_outlets FOR ALL TO authenticated
    USING (public.app_is_admin() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_outlets.task_id AND t.organization_id = public.app_org_id()))
    WITH CHECK (public.app_is_admin() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_outlets.task_id AND t.organization_id = public.app_org_id()));

REVOKE ALL ON public.shift_definitions, public.areas, public.outlet_shifts, public.outlet_areas, public.task_outlets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_definitions, public.areas, public.outlet_shifts, public.outlet_areas, public.task_outlets TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seed and backfill
-- ---------------------------------------------------------------------------
--
-- Existing branches start with every shift at default hours and every area, so
-- nothing silently stops receiving work. The owner narrows it down afterwards.

DO $$
DECLARE o RECORD;
BEGIN
    FOR o IN SELECT id FROM public.organizations LOOP
        INSERT INTO public.shift_definitions (organization_id, name, sort_order)
        VALUES (o.id,'Opening',1),(o.id,'Mid',2),(o.id,'Closing',3)
        ON CONFLICT (organization_id, name) DO NOTHING;

        INSERT INTO public.areas (organization_id, name, sort_order)
        VALUES (o.id,'Kitchen',1),(o.id,'Dining area',2),(o.id,'Counter',3),(o.id,'Restroom',4)
        ON CONFLICT (organization_id, name) DO NOTHING;
    END LOOP;
END $$;

INSERT INTO public.outlet_shifts (outlet_id, shift_id, starts_at, ends_at)
SELECT o.id, s.id,
       CASE s.name WHEN 'Opening' THEN TIME '09:00' WHEN 'Mid' THEN TIME '12:00' ELSE TIME '18:00' END,
       CASE s.name WHEN 'Opening' THEN TIME '12:00' WHEN 'Mid' THEN TIME '18:00' ELSE TIME '23:00' END
  FROM public.outlets o
  JOIN public.shift_definitions s ON s.organization_id = o.organization_id
ON CONFLICT (outlet_id, shift_id) DO NOTHING;

INSERT INTO public.outlet_areas (outlet_id, area_id)
SELECT o.id, a.id FROM public.outlets o
  JOIN public.areas a ON a.organization_id = o.organization_id
ON CONFLICT DO NOTHING;

-- The titles literally say Opener and Closer, so the shift is reliable. The area
-- is not derivable from a title, so everything starts in Kitchen to be re-filed.
UPDATE public.tasks t SET shift_id = s.id
  FROM public.shift_definitions s
 WHERE s.organization_id = t.organization_id AND t.shift_id IS NULL
   AND s.name = CASE WHEN t.title ILIKE 'Closer%' THEN 'Closing'
                     WHEN t.title ILIKE 'Opener%' THEN 'Opening'
                     ELSE 'Mid' END;

UPDATE public.tasks t SET area_id = a.id
  FROM public.areas a
 WHERE a.organization_id = t.organization_id AND t.area_id IS NULL AND a.name = 'Kitchen';

ALTER TABLE public.tasks ALTER COLUMN shift_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN area_id  SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Recurrence, now with real deadlines
-- ---------------------------------------------------------------------------
--
-- Replaces the version from 0007, which created every task with no due_time and
-- so could not make anything late before midnight.
--
-- Note the two different dates. assigned_date is the business day the shift
-- belongs to; due_date is when the deadline actually falls. They differ only for
-- a shift that runs past midnight, and keeping them separate is what lets
-- tonight's closing work appear on tonight's list while being due at 2am.

CREATE OR REPLACE FUNCTION public.materialise_recurring_tasks()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_created INTEGER := 0; r RECORD;
BEGIN
    FOR r IN
        SELECT t.id AS task_id,
               t.organization_id,
               ou.id AS outlet_id,
               (NOW() AT TIME ZONE COALESCE(o.timezone,'UTC'))::date AS business_day,
               COALESCE(t.due_time_override, os.ends_at) AS due_time,
               -- An override is a wall-clock time on the business day itself. A
               -- shift whose end is not after its start runs past midnight.
               CASE WHEN t.due_time_override IS NULL AND os.ends_at <= os.starts_at THEN 1 ELSE 0 END AS day_offset
          FROM public.tasks t
          JOIN public.organizations o  ON o.id = t.organization_id
          JOIN public.outlets ou       ON ou.organization_id = t.organization_id AND ou.is_active = true
          JOIN public.outlet_shifts os ON os.outlet_id = ou.id AND os.shift_id = t.shift_id
          JOIN public.outlet_areas oa  ON oa.outlet_id = ou.id AND oa.area_id = t.area_id
         WHERE t.is_recurring = true
           AND t.recurring_pattern = 'daily'
           AND (NOT EXISTS (SELECT 1 FROM public.task_outlets x WHERE x.task_id = t.id)
                OR EXISTS (SELECT 1 FROM public.task_outlets x WHERE x.task_id = t.id AND x.outlet_id = ou.id))
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
END; $fn$;

REVOKE ALL ON FUNCTION public.materialise_recurring_tasks() FROM PUBLIC, anon, authenticated;

-- Today's work predates all of this and has no deadline, so give it one from the
-- rules just established. Completed history is left alone: deriving deadlines
-- backwards would invent lateness that never happened.
UPDATE public.task_assignments a
   SET due_time = COALESCE(t.due_time_override, os.ends_at),
       due_date = a.assigned_date + CASE WHEN t.due_time_override IS NULL AND os.ends_at <= os.starts_at THEN 1 ELSE 0 END,
       updated_at = NOW()
  FROM public.tasks t
  JOIN public.outlet_shifts os ON os.shift_id = t.shift_id
 WHERE t.id = a.task_id
   AND os.outlet_id = a.outlet_id
   AND a.due_time IS NULL
   AND a.status <> 'completed';

COMMIT;
