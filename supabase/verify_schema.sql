-- verify_schema.sql
--
-- Read-only. Run this in the Supabase SQL editor against the live database and
-- compare the output to supabase/migrations/0001_baseline_schema.sql.
--
-- The baseline was reconstructed from ~148 unordered scripts whose execution order
-- is unknown, so it is an informed reconstruction rather than a certainty. This
-- script surfaces the places where reality and the baseline disagree, before any
-- migration is applied on top of them.
--
-- Nothing here modifies data.

-- === 1. RLS status per table (expect: decide explicitly, do not inherit) ===
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- === 2. Every existing policy, with its USING clause ===
-- Look specifically for any policy whose qual is simply "true". At least one such
-- policy exists on task_assignments (from fix_realtime_rls_policies.sql) and it
-- ORs away every stricter policy on the same table.
SELECT
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- === 3. Columns that the baseline expects, and whether they exist ===
WITH expected(table_name, column_name) AS (
    VALUES
        ('users', 'organization_id'),
        ('users', 'is_primary_admin'),
        ('users', 'current_streak'),
        ('users', 'longest_streak'),
        ('users', 'last_clear_board_date'),
        ('outlets', 'organization_id'),
        ('outlets', 'user_id'),
        ('outlets', 'username'),
        ('outlets', 'password'),
        ('staff_profiles', 'organization_id'),
        ('staff_profiles', 'username'),
        ('staff_profiles', 'password'),
        ('tasks', 'organization_id'),
        ('tasks', 'is_recurring'),
        ('tasks', 'recurring_pattern'),
        ('tasks', 'is_high_priority'),
        ('task_assignments', 'organization_id'),
        ('task_assignments', 'outlet_id'),
        ('task_assignments', 'reschedule_requested_at'),
        ('task_assignments', 'reschedule_reason'),
        ('task_assignments', 'reschedule_requested_by'),
        ('task_assignments', 'reschedule_approved_at'),
        ('task_assignments', 'reschedule_approved_by'),
        ('task_assignments', 'reschedule_new_due_date'),
        ('monthly_schedules', 'organization_id'),
        ('daily_schedules', 'organization_id'),
        ('task_completion_proofs', 'file_size'),
        ('task_completion_proofs', 'created_by'),
        ('invitations', 'organization_id')
)
SELECT
    e.table_name,
    e.column_name,
    CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'present' END AS status,
    c.data_type,
    c.is_nullable
FROM expected e
LEFT JOIN information_schema.columns c
       ON c.table_schema = 'public'
      AND c.table_name = e.table_name
      AND c.column_name = e.column_name
ORDER BY status, e.table_name, e.column_name;

-- === 4. Nullability of task_assignments.staff_id (baseline expects YES) ===
-- create_core_tables.sql declared this NOT NULL, but the application creates
-- outlet-only assignments with staff_id = null. If this reports NO, unassigned
-- task creation is currently failing at the database level.
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'task_assignments'
  AND column_name IN ('staff_id', 'outlet_id', 'organization_id');

-- === 5. Does public.users reference auth.users? ===
-- The baseline models users.id as a foreign key to auth.users. The original
-- create statement used a standalone default instead, which permits profile rows
-- with no corresponding auth account (and vice versa).
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_schema AS references_schema,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'users'
  AND tc.constraint_type = 'FOREIGN KEY';

-- === 6. Orphan check: profile rows with no auth account, and vice versa ===
SELECT 'public.users without auth.users' AS issue, COUNT(*) AS row_count
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
WHERE a.id IS NULL
UNION ALL
SELECT 'auth.users without public.users', COUNT(*)
FROM auth.users a
LEFT JOIN public.users u ON u.id = a.id
WHERE u.id IS NULL;

-- === 7. Rows that would break org scoping (null organization_id) ===
SELECT 'users' AS table_name, COUNT(*) AS null_org_rows FROM public.users WHERE organization_id IS NULL
UNION ALL SELECT 'outlets', COUNT(*) FROM public.outlets WHERE organization_id IS NULL
UNION ALL SELECT 'tasks', COUNT(*) FROM public.tasks WHERE organization_id IS NULL
UNION ALL SELECT 'task_assignments', COUNT(*) FROM public.task_assignments WHERE organization_id IS NULL
UNION ALL SELECT 'staff_profiles', COUNT(*) FROM public.staff_profiles WHERE organization_id IS NULL
UNION ALL SELECT 'monthly_schedules', COUNT(*) FROM public.monthly_schedules WHERE organization_id IS NULL
UNION ALL SELECT 'daily_schedules', COUNT(*) FROM public.daily_schedules WHERE organization_id IS NULL;

-- === 8. Triggers currently installed (two conflicting handle_new_user versions exist in the repo) ===
SELECT
    c.relname AS table_name,
    t.tgname AS trigger_name,
    p.proname AS function_name,
    pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname IN ('public', 'auth')
ORDER BY n.nspname, c.relname, t.tgname;

-- === 9. How exposed is the plaintext credential data right now? ===
SELECT 'outlets with a stored password' AS finding, COUNT(*) AS row_count
FROM public.outlets WHERE password IS NOT NULL
UNION ALL
SELECT 'staff_profiles with a stored password', COUNT(*)
FROM public.staff_profiles WHERE password IS NOT NULL;

-- === 10. Tier limit functions present? ===
SELECT p.proname, pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'get_organization_limits',
      'get_organization_usage_stats',
      'can_add_admin',
      'can_add_restaurant',
      'can_add_employee'
  )
ORDER BY p.proname;
