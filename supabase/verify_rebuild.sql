-- verify_rebuild.sql
--
-- Read-only. Run in the Supabase SQL editor after 0003_rebuild.sql.
-- Every row should read PASS. Anything else names what to look at.

WITH checks AS (

-- --------------------------------------------------------------------------
-- Model
-- --------------------------------------------------------------------------

SELECT 1 AS ord, 'only admin and outlet principals exist' AS check,
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE role NOT IN ('admin','outlet'))
            THEN 'PASS' ELSE 'FAIL' END AS result,
       (SELECT string_agg(DISTINCT role, ', ') FROM public.users) AS detail

UNION ALL SELECT 2, 'every profile has an auth account',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM public.users u
              WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id))
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT COUNT(*)::text || ' profiles' FROM public.users)

UNION ALL SELECT 3, 'users.id is keyed to auth.users',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_id_fkey')
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 4, 'exactly one primary admin per organization',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM public.users WHERE is_primary_admin
              GROUP BY organization_id HAVING COUNT(*) <> 1)
            AND (SELECT COUNT(*) FROM public.users WHERE is_primary_admin) > 0
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT COUNT(*)::text || ' primary admins' FROM public.users WHERE is_primary_admin)

UNION ALL SELECT 5, 'staff roster carries its own name',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='staff_profiles' AND column_name='name')
            AND NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE name IS NULL OR trim(name)='')
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT COUNT(*)::text || ' staff' FROM public.staff_profiles)

UNION ALL SELECT 6, 'staff_profiles no longer references users',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_schema='public' AND table_name='staff_profiles' AND column_name='user_id')
            THEN 'PASS' ELSE 'FAIL' END, NULL

-- --------------------------------------------------------------------------
-- Credentials and dead objects
-- --------------------------------------------------------------------------

UNION ALL SELECT 10, 'no plaintext password columns remain',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_schema='public' AND column_name IN ('password','username'))
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(table_name||'.'||column_name, ', ') FROM information_schema.columns
        WHERE table_schema='public' AND column_name IN ('password','username'))

UNION ALL SELECT 11, 'auth-minting triggers are gone',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                             WHERE n.nspname='public' AND p.proname IN (
                                 'create_auth_user_for_staff','cleanup_auth_user_for_staff',
                                 'cleanup_auth_user_for_outlet','sync_existing_staff_to_auth',
                                 'sync_existing_outlet_to_auth','handle_new_user'))
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 12, 'recursion-prone identity helpers are gone',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                             WHERE n.nspname='public' AND p.proname IN (
                                 'is_admin','is_staff_user','is_outlet_user',
                                 'current_user_organization_id','user_belongs_to_organization'))
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 13, 'duplicate priority column is gone',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_schema='public' AND table_name='tasks' AND column_name='ishighpriority')
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 14, 'unused staff_working_hours is gone',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables
                             WHERE table_schema='public' AND table_name='staff_working_hours')
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 15, 'every SECURITY DEFINER function pins search_path',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.prosecdef AND p.proconfig IS NULL)
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(p.proname, ', ') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.prosecdef AND p.proconfig IS NULL)

-- --------------------------------------------------------------------------
-- Data integrity
-- --------------------------------------------------------------------------

UNION ALL SELECT 20, 'no duplicate monthly schedules',
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.monthly_schedules
                             GROUP BY staff_id, month, year HAVING COUNT(*) > 1)
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT COUNT(*)::text || ' rows' FROM public.monthly_schedules)

UNION ALL SELECT 21, 'no duplicate daily schedules',
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.daily_schedules
                             GROUP BY monthly_schedule_id, schedule_date HAVING COUNT(*) > 1)
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT COUNT(*)::text || ' rows' FROM public.daily_schedules)

UNION ALL SELECT 22, 'no schedule row is missing its organization',
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.daily_schedules WHERE organization_id IS NULL)
            AND  NOT EXISTS (SELECT 1 FROM public.monthly_schedules WHERE organization_id IS NULL)
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 23, 'no day off carries a shift',
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.daily_schedules
                             WHERE is_day_off AND (outlet_id IS NOT NULL OR time_in IS NOT NULL))
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 24, 'every assignment belongs to an outlet',
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.task_assignments WHERE outlet_id IS NULL)
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT COUNT(*)::text || ' assignments' FROM public.task_assignments)

UNION ALL SELECT 25, 'all timestamps are timezone aware',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_schema='public' AND data_type='timestamp without time zone')
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(table_name||'.'||column_name, ', ') FROM information_schema.columns
        WHERE table_schema='public' AND data_type='timestamp without time zone')

-- --------------------------------------------------------------------------
-- Access control
-- --------------------------------------------------------------------------

UNION ALL SELECT 30, 'RLS is enabled on every table',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity)
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(c.relname, ', ') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity)

UNION ALL SELECT 31, 'no table has RLS on with zero policies',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
                AND NOT EXISTS (SELECT 1 FROM pg_policies p
                                WHERE p.schemaname='public' AND p.tablename=c.relname))
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(c.relname, ', ') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
          AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname))

UNION ALL SELECT 32, 'no USING (true) policy survives',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND qual = 'true'
                AND 'supabase_auth_admin' <> ALL (roles))
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(tablename||'.'||policyname, ', ') FROM pg_policies
        WHERE schemaname='public' AND qual='true' AND 'supabase_auth_admin' <> ALL (roles))

UNION ALL SELECT 33, 'no policy is granted to the public role',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE schemaname='public' AND 'public' = ANY (roles))
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(tablename||'.'||policyname, ', ') FROM pg_policies
        WHERE schemaname='public' AND 'public' = ANY (roles))

UNION ALL SELECT 34, 'anon has no table access',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND grantee='anon')
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(DISTINCT table_name, ', ') FROM information_schema.role_table_grants
        WHERE table_schema='public' AND grantee='anon')

UNION ALL SELECT 35, 'authenticated cannot write role or organization_id on users',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM information_schema.column_privileges
              WHERE table_schema='public' AND table_name='users' AND grantee='authenticated'
                AND privilege_type='UPDATE'
                AND column_name IN ('role','organization_id','is_primary_admin','email','id'))
            THEN 'PASS' ELSE 'FAIL' END,
       (SELECT string_agg(column_name, ', ') FROM information_schema.column_privileges
        WHERE table_schema='public' AND table_name='users' AND grantee='authenticated'
          AND privilege_type='UPDATE')

UNION ALL SELECT 36, 'access token hook exists and is restricted',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                         WHERE n.nspname='public' AND p.proname='custom_access_token_hook')
            AND has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE')
            AND NOT has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'EXECUTE')
            THEN 'PASS' ELSE 'FAIL' END, NULL

-- The only two ways a bare auth account becomes a principal. If either is
-- missing or callable by anon, account provisioning is broken or wide open.
UNION ALL SELECT 36.5, 'provisioning RPCs exist and are restricted to authenticated',
       CASE WHEN has_function_privilege('authenticated', 'public.bootstrap_organization(text,text,text)', 'EXECUTE')
            AND has_function_privilege('authenticated', 'public.redeem_outlet_invitation(text)', 'EXECUTE')
            AND NOT has_function_privilege('anon', 'public.bootstrap_organization(text,text,text)', 'EXECUTE')
            AND NOT has_function_privilege('anon', 'public.redeem_outlet_invitation(text)', 'EXECUTE')
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 37, 'branch assignment guard is installed',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                         WHERE tgname='trg_guard_branch_assignment_update' AND NOT tgisinternal)
            THEN 'PASS' ELSE 'FAIL' END, NULL

UNION ALL SELECT 38, 'proof storage bucket exists and is private',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id='task-proofs' AND NOT public)
            THEN 'PASS' ELSE 'CHECK' END,
       'if CHECK, create bucket task-proofs manually (private, 25 MB)'

-- Section 20 swallows its own errors so a storage permission problem cannot roll
-- back the rebuild, which means this is the only place a failure there shows up.
UNION ALL SELECT 39, 'proof storage policies exist',
       CASE WHEN (SELECT COUNT(*) FROM pg_policies
                  WHERE schemaname='storage' AND tablename='objects'
                    AND policyname IN ('proofs_read','proofs_insert')) = 2
            THEN 'PASS' ELSE 'CHECK' END,
       'if CHECK, add them in the dashboard against bucket task-proofs'

UNION ALL SELECT 40, 'proof files cannot be altered or deleted by a client',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE schemaname='storage' AND tablename='objects'
                AND cmd IN ('UPDATE','DELETE')
                AND qual LIKE '%task-proofs%')
            THEN 'PASS' ELSE 'FAIL' END, NULL

)
SELECT check, result, detail FROM checks ORDER BY ord;

-- --------------------------------------------------------------------------
-- The one thing SQL cannot verify
-- --------------------------------------------------------------------------
--
-- Whether the access token hook is REGISTERED. It lives in the auth service
-- config, not the database. Dashboard > Authentication > Hooks > Customize
-- Access Token must point at public.custom_access_token_hook.
--
-- To confirm it works, sign out, sign back in, and run this as that user:
--
--     SELECT auth.jwt() ->> 'user_role'       AS role,
--            auth.jwt() ->> 'organization_id' AS org,
--            auth.jwt() ->> 'outlet_id'       AS outlet;
--
-- All three null means the hook is not registered, and every policy will deny.
