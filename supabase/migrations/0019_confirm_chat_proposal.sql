-- 0019_confirm_chat_proposal
--
-- Turns a proposal the owner approved into real tasks.
--
-- This has to be a SECURITY DEFINER function rather than a few inserts from the
-- client, for two reasons.
--
-- The first is the audit trail. agent_actions has a SELECT policy and nothing else,
-- so no client can write to it — which is the point, since a record the actor can
-- forge is not a record. The comment on that table says the audit row is what makes
-- an agent that reassigns work and offboards people acceptable to run. Creating the
-- tasks and writing the row therefore have to happen together, in one transaction
-- that the caller cannot half-complete.
--
-- The second is integrity of consent. The function takes a message id, not a list of
-- tasks, and re-reads the proposal out of chat_messages itself. The owner approves
-- what they were shown on the card, and a tampered client cannot substitute something
-- else at the moment of confirmation. Passing the tasks in as an argument would have
-- made the confirmation step decorative.
--
-- Recurring work is deliberately not materialised here. The hourly job owns that, and
-- two things creating the same assignments is how you get duplicates. Only one-off
-- work gets its assignment written directly, because nothing else would ever create it.

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_chat_proposal(p_message_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
    v_uid      UUID := auth.uid();
    v_org      UUID := public.app_org_id();
    v_proposal JSONB;
    v_state    TEXT;
    v_task     JSONB;
    v_task_id  UUID;
    v_created  UUID[] := '{}';
    v_assigned INTEGER := 0;
    v_batch    INTEGER;
    v_today    DATE;
    v_on       DATE;
BEGIN
    IF NOT public.app_is_admin() THEN
        RAISE EXCEPTION 'Only the owner can schedule work from the assistant';
    END IF;

    -- Joined through the conversation, so one owner cannot confirm another's
    -- proposal even holding its id.
    SELECT m.proposal, m.proposal_state
      INTO v_proposal, v_state
      FROM public.chat_messages m
      JOIN public.chat_conversations c ON c.id = m.conversation_id
     WHERE m.id = p_message_id
       AND c.user_id = v_uid
       AND m.organization_id = v_org;

    IF v_proposal IS NULL THEN
        RAISE EXCEPTION 'There is no proposal on that message';
    END IF;

    -- Confirming twice would create the work twice. The state is the lock.
    IF v_state IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'That proposal was already %', COALESCE(v_state, 'settled');
    END IF;

    SELECT (NOW() AT TIME ZONE COALESCE(o.timezone, 'UTC'))::date
      INTO v_today
      FROM public.organizations o
     WHERE o.id = v_org;

    FOR v_task IN SELECT * FROM jsonb_array_elements(v_proposal -> 'tasks')
    LOOP
        v_on := COALESCE(NULLIF(v_task ->> 'onDate', '')::DATE, v_today);

        INSERT INTO public.tasks (
            title, description, estimated_minutes,
            is_recurring, recurring_pattern, recurring_weekday, recurring_day_of_month,
            scheduled_date, is_high_priority, shift_id, area_id, due_time_override,
            answer_type, answer_prompt, requires_photo,
            organization_id, created_by
        ) VALUES (
            v_task ->> 'title',
            NULLIF(v_task ->> 'description', ''),
            COALESCE(NULLIF(v_task ->> 'estimatedMinutes', '')::INT, 15),
            (v_task ->> 'recurrence') IS DISTINCT FROM 'once',
            NULLIF(v_task ->> 'recurrence', 'once'),
            CASE WHEN v_task ->> 'recurrence' = 'weekly'
                 THEN NULLIF(v_task ->> 'weekday', '')::SMALLINT END,
            CASE WHEN v_task ->> 'recurrence' = 'monthly'
                 THEN NULLIF(v_task ->> 'dayOfMonth', '')::SMALLINT END,
            CASE WHEN v_task ->> 'recurrence' = 'once' THEN v_on END,
            COALESCE(NULLIF(v_task ->> 'isHighPriority', '')::BOOLEAN, FALSE),
            (v_task ->> 'shiftId')::UUID,
            (v_task ->> 'areaId')::UUID,
            NULLIF(v_task ->> 'dueTime', '')::TIME,
            COALESCE(NULLIF(v_task ->> 'answerType', ''), 'none'),
            NULLIF(v_task ->> 'answerPrompt', ''),
            COALESCE(NULLIF(v_task ->> 'requiresPhoto', '')::BOOLEAN, FALSE),
            v_org, v_uid
        )
        RETURNING id INTO v_task_id;

        v_created := v_created || v_task_id;

        -- An empty list means every qualifying branch, which is the absence of rows
        -- here rather than a row per branch.
        INSERT INTO public.task_outlets (task_id, outlet_id)
        SELECT v_task_id, (value #>> '{}')::UUID
          FROM jsonb_array_elements(COALESCE(v_task -> 'outletIds', '[]'::jsonb));

        IF (v_task ->> 'recurrence') = 'once' THEN
            -- Same qualification the hourly job applies: the branch must run this
            -- task's shift, have its area, and be targeted by it.
            INSERT INTO public.task_assignments
                (task_id, staff_id, outlet_id, organization_id,
                 assigned_date, due_date, due_time, status)
            SELECT v_task_id, NULL, ou.id, v_org,
                   v_on,
                   v_on + CASE WHEN NULLIF(v_task ->> 'dueTime', '') IS NULL
                                AND os.ends_at <= os.starts_at THEN 1 ELSE 0 END,
                   COALESCE(NULLIF(v_task ->> 'dueTime', '')::TIME, os.ends_at),
                   'pending'
              FROM public.outlets ou
              JOIN public.outlet_shifts os
                ON os.outlet_id = ou.id AND os.shift_id = (v_task ->> 'shiftId')::UUID
              JOIN public.outlet_areas oa
                ON oa.outlet_id = ou.id AND oa.area_id = (v_task ->> 'areaId')::UUID
             WHERE ou.organization_id = v_org
               AND ou.is_active
               AND (NOT EXISTS (SELECT 1 FROM public.task_outlets x WHERE x.task_id = v_task_id)
                    OR EXISTS (SELECT 1 FROM public.task_outlets x
                                WHERE x.task_id = v_task_id AND x.outlet_id = ou.id));

            GET DIAGNOSTICS v_batch = ROW_COUNT;
            v_assigned := v_assigned + v_batch;
        END IF;
    END LOOP;

    UPDATE public.chat_messages
       SET proposal_state = 'confirmed'
     WHERE id = p_message_id;

    INSERT INTO public.agent_actions
        (organization_id, actor_user_id, actor_role, source, operation, arguments, result)
    VALUES (
        v_org, v_uid, 'admin', 'chat', 'confirm_chat_proposal',
        jsonb_build_object('message_id', p_message_id, 'proposal', v_proposal),
        jsonb_build_object('task_ids', to_jsonb(v_created), 'assignments_created', v_assigned)
    );

    RETURN jsonb_build_object(
        'taskIds', to_jsonb(v_created),
        'assignmentsCreated', v_assigned
    );
END;
$fn$;

REVOKE ALL     ON FUNCTION public.confirm_chat_proposal(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.confirm_chat_proposal(UUID) TO authenticated;

COMMIT;
