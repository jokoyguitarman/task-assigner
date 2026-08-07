# Verified live database state

Read from the production database on 2026-08-06 through the Supabase MCP server,
querying `information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_proc`,
`pg_trigger`, `pg_policies`, `storage.buckets`, and the Supabase advisor linter.

Everything below is observed, not inferred. `migrations/0001_baseline_schema.sql`
transcribes it.

## Size

| | |
| --- | --- |
| Organizations | 1 |
| Outlets | 4 (3 storing a plaintext password) |
| Tasks | 5 |
| Task assignments | 58 (6 unassigned, 0 with a due time, 0 with proof) |
| Monthly schedules | 57 |
| Daily schedules | 174 |
| Invitations | 2 |
| `auth.users` | 3 |
| `public.users` | 14 (2 admin, 2 outlet, 10 staff) |
| `public.users` with no matching auth account | 11 |
| Storage buckets | 0 |

Small enough that any migration can be done in one pass, and small enough that a
full logical backup is trivial. Take one before applying anything.

## Security findings

RLS is enabled on all twelve tables, which is better than the repository's SQL
history suggested. The policies attached to it are the problem. Postgres ORs
permissive policies together, so on each table the most permissive policy wins.

### Any user can make themselves an admin of any organization

```sql
CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
```

RLS filters rows, not columns. The policy constrains *which* row you may update,
and places no constraint on what you may put in it. `role` and `organization_id`
live in that row. A signed-in user can therefore run

```sql
UPDATE users SET role = 'admin', organization_id = '<any org>' WHERE id = auth.uid();
```

and every `is_admin()` and `current_user_organization_id()` check in the policy
set then answers in their favour. This is reachable by anyone who can sign up.

### Signing up as `admin@anything` grants the admin role

`handle_new_user`, the `AFTER INSERT` trigger on `auth.users`:

```sql
WHEN NEW.email LIKE '%admin%' THEN 'admin'
WHEN NEW.email LIKE '%manager%' THEN 'admin'
ELSE 'staff'
```

Substring match on an attacker-supplied address. `admin@gmail.com` qualifies, and
so does `notanadmin@example.com`. The trigger also leaves `organization_id` null,
so the profile it writes belongs to no tenant until something backfills it.

### Every invitation token is world-readable

Two policies, both `FOR SELECT USING (true)` granted to `public`, which includes
`anon`:

- `Allow public read invitations by token`
- `Public read invitations for signup`

Anyone holding the anon key — which ships in the client bundle — can list every
invitation across every organization, tokens included, and redeem them. The
intent was to let an invited user load their invitation before signing in; the
implementation exposes the whole table.

### Every assignment is readable by every signed-in account

```sql
CREATE POLICY "task_assignments_realtime_access" ON task_assignments
    FOR SELECT TO authenticated USING (true);
```

This is load-bearing, which is why it cannot simply be dropped. The policy that
should cover staff reads is

```sql
CREATE POLICY "task_assignments_staff_own" ON task_assignments
    FOR ALL TO authenticated USING (staff_id = auth.uid() OR ...);
```

but `task_assignments.staff_id` is a foreign key to `staff_profiles(id)`, while
`auth.uid()` returns an `auth.users` id. The two id spaces are unrelated, so the
comparison never matches and the policy has never granted anything. `USING (true)`
was added on top to make Realtime deliver events. Removing it without first
fixing the staff identity model logs every staff member out of their own tasks.

### `anon` may insert into `users` and `organizations`

Both `WITH CHECK (true)`, added so the client-side signup flow could write its own
tenant. Combined with client-supplied `subscription_tier`, `max_admins`,
`max_restaurants` and `max_employees` in `RestaurantSignup`, tier limits are
advisory.

### Two tables are unreachable

`staff_working_hours` and `task_completion_proofs` have RLS enabled and zero
policies, so the client sees them as permanently empty. Both are in fact empty,
so nothing is currently broken by it, but any feature built on them will fail
silently until policies exist.

### Lower severity

- Seventeen `SECURITY DEFINER` functions have a mutable `search_path` and are
  granted `EXECUTE` to `anon`, so each is callable unauthenticated at
  `/rest/v1/rpc/<name>`.
- Leaked-password protection (HaveIBeenPwned) is off.
- Postgres `17.4.1.075` has security patches outstanding.

## The identity model

Confirmed with the owner, 2026-08-06. This is the intended design, and much of
the schema's apparent breakage is the schema half-implementing it.

**There are exactly two kinds of principal: the owner and the branch.** Staff do
not log in. They work from the shared store phone, which is signed in as the
outlet. A staff member is a roster entry — a name that can own a task, complete
it, and be scheduled — not an account.

| Profile | Count | Has an auth account | Should it? |
| --- | --- | --- | --- |
| admin, `is_primary_admin = true` | 1 | no | yes — this one is a ghost |
| admin | 1 | yes | yes |
| outlet | 2 | yes | yes |
| staff | 10 | no | **no** |

So ten of the eleven profiles without logins are correct. Several things follow,
and they simplify the remediation considerably:

- **`task_assignments.staff_id` referencing `staff_profiles(id)` is right**, not a
  bug. The policy comparing it to `auth.uid()` is still dead, but the fix is to
  scope assignments by `outlet_id` — the branch is the principal — rather than to
  drag `staff_id` into the auth id space.
- **The `USING (true)` leak can therefore be closed immediately.** It does not
  depend on any auth migration. This was the one hard ordering constraint in the
  plan and it no longer exists.
- **`create_auth_user_for_staff` and `cleanup_auth_user_for_staff` should be
  dropped outright**, not repaired. They mint `auth.users` rows for people who
  are not supposed to have them, and their destructive interaction is moot.
- **`staff_profiles.username` and `password` have no purpose at all** and can be
  dropped without a credential migration.
- **The ten `users` rows with `role = 'staff'` are vestigial.** They exist only to
  hold a name, because `staff_profiles` has no name column of its own and reaches
  it through `user_id`. They are non-principals sitting in the principals table,
  and they are what inflates the tier-limit employee count. Folding the name into
  `staff_profiles` and deleting them is the clean end state.
- **Streak counters live on `users`** and therefore currently track a principal
  who never signs in. They belong on `staff_profiles`.
- **Completion attribution is self-declared.** Whoever holds the store phone picks
  a name from a list. That is inherent to a shared device and is a reason the
  photo proof pipeline matters more than it would otherwise.

The one genuinely broken account is the primary admin, which has no auth row. The
owner's working login has `is_primary_admin = false`, meaning `RestaurantSignup`
did not create it; it matches the fallback in `authAPI.login`:

```ts
// If user profile doesn't exist, create it
role: 'admin', // Default to admin for now, you might want to make this configurable
```

The owner's login works because a client-side fallback grants admin to anyone
whose profile row is missing at login time. That fallback needs to go, and the
primary-admin row needs a real account attached.

### Restaurant signup is probably broken

`handle_new_user` fires `AFTER INSERT ON auth.users` and writes a profile row.
`RestaurantSignup` then inserts its own row with the same `id`, which should fail
on the primary key and surface as "Failed to create user profile" — leaving an
orphan organization and auth account behind.

The evidence is consistent with this: exactly one organization exists, its
primary-admin profile has no auth account, and the working admin came from the
login fallback instead. The likely history is that signup worked before the
trigger scripts in `legacy-sql/triggers/` were applied, and has not worked since.

This is worth reproducing against a scratch project before building on top of it.

## Correctness findings

### Editing a staff profile deletes that person's login

Two triggers on `staff_profiles` write directly into `auth.users`:

| Trigger | Timing | Effect |
| --- | --- | --- |
| `trigger_cleanup_auth_user_for_staff` | `BEFORE DELETE OR UPDATE` | Deletes the auth user derived from `OLD.username` |
| `trigger_create_auth_user_for_staff` | `AFTER INSERT OR UPDATE` | Recreates it, **only if `NEW.password` is non-empty** |

No staff row currently stores a password. So any update to a staff profile —
toggling `is_active`, changing a position — runs the delete and skips the
recreate. This is the most likely explanation for the 11 profiles with no auth
account.

Both functions hash with `crypt()` and populate GoTrue's internal columns by
hand, and both mint a new random `id` each time rather than reusing the old one,
so even the successful path orphans anything that referenced the previous id. The
generated address is `<username>+staff@taskassigner.local`, a domain that cannot
receive mail, so these accounts can never reset a password.

### `tasks` has two priority columns

`ishighpriority` and `is_high_priority`, both `NOT NULL DEFAULT FALSE`, nothing
keeping them in step. They already disagree on 3 of 5 rows. The indexes read
`ishighpriority`; the TypeScript reads `is_high_priority`.

### Tier limits count the wrong thing

`get_organization_limits` and `get_organization_usage_stats` both compute the
employee count as every user in the organization, admins and outlet logins
included. On the free tier the owner spends employee slots on themselves.
`get_organization_limits` also omits `subscription_tier`, which the `TierLimits`
interface in `src/services/tierLimitsService.ts` declares, so that field is
always `undefined`.

Changing either return type requires `DROP FUNCTION` first; `CREATE OR REPLACE`
cannot alter a signature.

### Invitations are created without an organization

`invitationsAPI.create` inserts `email`, `role`, `outlet_id`, `token`,
`expires_at` and `created_by`, but not `organization_id`. The org-scoped policy's
`WITH CHECK` therefore evaluates to NULL and would reject the insert; it succeeds
only because `Admin full access to invitations` has no `WITH CHECK` of its own
and falls back to `is_admin()`. The rows land with a null `organization_id`,
invisible to the org-scoped read and visible only to the admin policy. Harmless
in a single-tenant deployment, silently wrong in a second one.

`usersAPI.create` has the same shape of bug: `StaffEnrollment` passes
`organizationId`, and the insert body omits it.

### Invited staff see an empty outlet list

`SignupForm` calls `outletsAPI.getAll()` before the invitee has signed in. The
`outlets` SELECT policy is scoped to `current_user_organization_id()`, which is
null for `anon`, so the outlet dropdown is always empty — and the form refuses to
submit a staff signup without an outlet. The invitation itself carries
`outlet_id`, so the dropdown is redundant; `get_invitation_by_token` now returns
`outlet_name` so the form can display it instead of fetching the list.

### Missing constraints

- `monthly_schedules` has no `UNIQUE (staff_id, month, year)`, so the scheduler
  can create duplicate months for one person.
- `daily_schedules` has no `UNIQUE (monthly_schedule_id, schedule_date)` and no
  `ON DELETE CASCADE` from its parent.
- `staff_profiles.employee_id` is `UNIQUE` but nullable, so any number of rows
  may have no employee id.
- Nothing constrains `is_day_off` against `outlet_id`/`time_in`/`time_out`, so a
  day off can carry a shift.

### Missing indexes

`task_assignments` is indexed on `organization_id` and the reschedule columns
only. Nothing on `staff_id`, `outlet_id`, `task_id`, `due_date` or `status`, all
of which the dashboards filter on. Irrelevant at 58 rows; not irrelevant later.

### Timestamps are `timestamp without time zone`

Every `created_at`, `updated_at`, `completed_at`, and `uploaded_at` except on
`invitations` and the reschedule columns. Written with `NOW()` server-side and
compared against client-side `Date` objects, which is a silent offset for a
business whose day ends after midnight.

### Things the reconstruction had wrong

The pre-verification baseline asserted a number of things that turned out to be
false. Recorded here because they shaped earlier reasoning:

| Assumed | Actual |
| --- | --- |
| RLS mostly disabled | Enabled on all twelve tables |
| `users.id` references `auth.users(id)` | No foreign key; defaults to `gen_random_uuid()` |
| `task_assignments.staff_id` references `users(id)` | References `staff_profiles(id)` |
| `staff_id` might be `NOT NULL` and breaking unassigned tasks | Nullable; 6 rows use it |
| `due_time` needs to be added | Already exists as `TIME`, populated on 0 rows |
| `organization_id` on assignments is nullable | `NOT NULL` |
| Timestamps are `TIMESTAMPTZ` | `TIMESTAMP` |
| `daily_schedules_logic_check` exists | Does not exist |
| `day_off_type` tolerates `''` | Rejects it; only the four named values or NULL |
| `monthly_schedules` has `UNIQUE (staff_id, month, year)` | No such constraint |
| Proof rows point at `file_url` | Column is `file_path` |
| `staff_working_hours` does not exist | Exists, empty, no policies |

## Remediation: one transactional rebuild

The seven planned migrations collapsed into `0003_rebuild.sql`. With only two
kinds of principal there was no hard ordering constraint left, and Postgres DDL
is transactional, so the whole rewrite lands atomically or not at all. That
removes the "reason about existing state" tax that made the incremental plan
tedious: the first third of the file deletes the existing state.

The database has had no writes since 2025-10-25, so there is no live traffic to
coordinate around.

### What the rebuild does

| Section | Change |
| --- | --- |
| 0 | Preflight assertions; aborts if the database is not in the verified state |
| 1–3 | Drops all 35 policies, the five auth-minting functions, the five recursion-prone identity helpers, the signup trigger, and the unused `staff_working_hours` |
| 4 | `staff_profiles` becomes the roster: gains `name`, `outlet_id`, the streak columns; loses `user_id`, `username`, `password` |
| 5 | `users` becomes principals only: staff rows deleted, ghost admin's flag transferred to a real account then deleted, `id` keyed to `auth.users`, role restricted to `admin`/`outlet` |
| 6–9 | Outlet credentials dropped, positions become tenant-aware, duplicate priority column collapsed, `completion_notes` and `completed_by_staff_id` added, five missing indexes |
| 10 | Deduplicates 41 surplus monthly and 24 surplus daily schedule rows, backfills 41 missing `organization_id`s, adds the unique constraints that would have prevented all of it |
| 11–12 | `organizations.timezone`; every naive timestamp converted to `timestamptz` as UTC; one shared `updated_at` trigger |
| 13–17 | `agent_actions` audit table, the access token hook, corrected tier functions, invitation RPCs, `bootstrap_organization` |
| 18–20 | `anon` loses all table access, column grants on `users`, the new policy set, private proof bucket |

### Two things worth calling out

**A branch cannot move its own deadline.** RLS chooses rows, not columns, so the
policy that lets a branch update its own assignments would also let it push
`due_date` into next week — which would defeat the product entirely, since the
owner would see everything completed on time. A `BEFORE UPDATE` trigger rejects
changes to `task_id`, `outlet_id`, `staff_id`, `assigned_date`, `due_date`,
`due_time` and the reschedule approval columns when the actor is a branch. It
recognises the owner and `service_role` and stays out of their way.

**The storage section cannot abort the migration.** Depending on how the project
was provisioned, the SQL editor role may not own `storage.objects`. A bare
permission error there would roll back the entire rebuild over a bucket, so it is
wrapped in an exception handler that warns and continues.

## Client changes the rebuild requires

The rebuild is deliberately not backward compatible — half its purpose is to make
the unsafe client paths fail loudly. **These are now done in the working tree**;
they are recorded here so the reasoning survives.

**Applied:**

- `authAPI.login` no longer repairs a missing profile by inserting one with
  `role: 'admin'`. A missing profile raises `ProfileNotProvisionedError`, and the
  app routes to `/setup`.
- Identity comes from the access token. `AuthContext` decodes `user_role`,
  `organization_id` and `outlet_id` from the JWT via `src/lib/authClaims.ts`
  rather than guessing from `user_metadata` and defaulting to admin with a
  hardcoded organization id.
- `RestaurantSignup.tsx` creates only the auth account, then calls
  `bootstrap_organization`. `AccountSetup.tsx` is the screen for an account that
  is signed in but not yet a principal, offering bootstrap or invitation
  redemption.
- `SignupForm.tsx` redeems a branch invitation through
  `redeem_outlet_invitation` instead of inserting into `users`, `outlets` and
  `staff_profiles` itself. Its role selector is gone.
- `StaffEnrollment.tsx` writes one `staff_profiles` row with `name`, `outlet_id`
  and `organization_id`. It no longer creates a user, and no longer invents a
  `EMP001@company.com` placeholder email.
- `outletsAPI` and `OutletManagement.tsx` no longer read or write
  `username`/`password`.
- Streaks read and write `staff_profiles`. The dashboard no longer recalculates
  them on every load against the signed-in account.
- Every `staff_profiles.user_id` join for a name reads `staff_profiles.name`.
  Four screens dropped a `usersAPI.getAll()` that existed only for that.
- Deleted: `AdminSignup.tsx` and its public `/admin-signup` route (hardcoded
  `role: 'admin'`), `StaffAccountCreation.tsx` and `/staff-accounts` (minted
  staff logins), `StaffOutletAuth.tsx` and `/staff-signup` (a second login path
  that wrote its own `localStorage` session), and `services/api.ts` (dead mock
  API that nothing imported).

**Bugs found and fixed while doing it:**

- `task_completion_proofs` was written with a `file_url` key; the column is
  `file_path`, so every proof insert would have failed. `TaskCompletion.tsx` now
  actually uploads to the `task-proofs` bucket instead of discarding the file
  and the notes.
- No table has an `organization_id` default, so every `create` in the service
  layer was inserting NULL. They now stamp it from the caller's claim, which the
  new NOT NULL constraints require.
- `AssignmentForm` collected a due time and dropped it on both create and update.
  It is persisted now, so a task can be late the same evening.
- Schedule dates were serialised with `toISOString()`, which converts to UTC
  first and moves an evening edit in Manila onto the previous day. They are sent
  as calendar dates now.
- Monthly and daily schedule creates are upserts, since the rebuild adds the
  unique constraints whose absence produced 41 and 24 duplicate rows.
- The hand-written `Database` interface in `src/lib/supabase.ts` was never passed
  to `createClient`, so it checked nothing, and had drifted from the schema.
  Removed in favour of generating types after the migration is applied.

**Client bugs found in the same pass, unrelated to the schema:**

These came out of clearing the build warnings, which had accumulated to the
point where nothing stood out. The build is now warning-free, so the next real
one will be visible.

- Four screens each had their own definition of "overdue" and they disagreed:
  the admin list ignored the due time, the branch dashboard ignored the status
  column and called anything past its due date overdue including completed work.
  All four now use `src/lib/assignmentStatus.ts`, which treats the deadline as
  the due date plus the due time.
- The streak calculation binned completions by the UTC day, so a task finished
  during a closing shift after midnight in Manila counted for the day before.
  It also counted from today unconditionally, which meant every streak read zero
  each morning until the first task of the day was ticked off.
- The admin dashboard's overdue sweep was awaited immediately after the load on
  mount, when `assignments` was still the empty initial state, so it never
  marked anything overdue. It runs after the data lands now.
- The schedule PDF derived each calendar cell's date with `toISOString()`, so
  every cell showed the previous day's shifts.
- The report screen's date filter left the end of the range at midnight, which
  dropped everything assigned during the last day of the range.
- Two duplicate copies of the loader in the branch dashboard had drifted: only
  one of them refreshed the roster and the streaks. Retrying after an error, and
  requesting a reschedule, both did a full `window.location.reload()`.
- `subscribeToDashboardMetrics` returned a cleanup that removed the map entry
  without closing the channel, and opened a second undocumented "test" channel
  on every call. Both leaked a websocket channel per mount. There was also a
  subscription to a `schedules` table that does not exist.
- Notifications were cached in one global `localStorage` key, so on a shared
  branch device the next account to sign in saw the previous one's. They are
  scoped per account now.
- The smart-assignment availability check issued one query per staff member and
  awaited them one at a time. It is one query for the month now.
- Dead code removed: `shiftDayOffsForward` (66 lines, no caller), a "Test
  Real-time" button left in the admin dashboard header, two localStorage effects
  in the scheduler that re-read a preference the initialiser already read, and
  three duplicate `UsageStats`/`TierLimits` interface definitions of which the
  two in `types/index.ts` were camel-cased and matched nothing the RPCs return.

**Keeps working unchanged:**

- `tierLimitsService` — `get_organization_limits`, `can_add_admin`,
  `can_add_restaurant` and `can_add_employee` keep their names and shapes. The
  employee count is corrected to come from the roster rather than from every user,
  and `get_organization_limits` now actually returns the `subscription_tier` the
  `TierLimits` interface always declared.
- `invitationsAPI` — already repointed at the RPCs in the working tree. It only
  issues branch invitations now; the staff option is gone, because staff have no
  login to invite them to.
- Task priority — the client only ever read `is_high_priority`, which is the
  column that survives.

### The step that is not SQL

The access token hook must be registered at **Authentication > Hooks > Customize
Access Token**. Every policy reads claims that only the hook can mint, so until
it is registered every signed-in user sees an empty app. Everyone must then sign
out and back in, because existing tokens predate the hook.

Run `supabase/verify_rebuild.sql` afterwards. It returns PASS or FAIL per row;
the one thing it cannot check is whether the hook is registered, so it tells you
how to confirm that by hand.

Then regenerate the client types, which `src/lib/supabase.ts` no longer carries
by hand:

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/database.types.ts
```

### How a login gets created after the rebuild

Clients cannot insert into `users`, so there are exactly two doors, both
server-side and both deciding the role themselves:

- `bootstrap_organization(name, admin_name, timezone)` — a new owner. Refuses if
  the account already has a profile. Sets the tier and its limits itself, so a
  signup cannot award itself a higher plan.
- `redeem_outlet_invitation(token)` — a branch. Requires that the caller's own
  email matches the invitation, so a leaked token is not enough on its own, and
  refuses if the branch already has a login.

The two outlets that currently have no login can be given one by inviting them
from Outlet Management and having them sign up with the emailed link. That
removes the need for the auth admin API for this case.

| File | Purpose | Status |
| --- | --- | --- |
| `0002_hotfix_privilege_escalation.sql` | Column-restricted user updates, invitation reads behind RPCs, `handle_new_user` without the email-substring admin rule | Never applied; superseded |
| `0003_rebuild.sql` | The whole rewrite, in one transaction | **Applied 2026-08-07** |
| `0004_tighten_function_grants.sql` | Closes the grants `0003` believed it had closed | **Applied 2026-08-07** |

`0002` was written because it could ship in minutes. `0003` went in first, so it
was skipped.

## What applying it actually changed

Preflight was re-measured against live data immediately before the run and every
blocking condition was zero, so nothing was forced.

| | Before | After |
| --- | --- | --- |
| `users` rows | 13 | 3 |
| Roles present | admin, staff, outlet | admin, outlet |
| `staff_profiles` | 10, name reached through `users` | 8, own `name`, all with a branch |
| `monthly_schedules` | 57 | 16 |
| `daily_schedules` | 174 | 109 |
| Policies on `public` | 35 | 27 |
| Naive `timestamp` columns | 17 | 0 |

The daily schedule count fell further than the 24 surplus rows measured
beforehand. That is the two-stage dedup working as intended rather than data
loss: children were first repointed onto the one surviving monthly schedule per
staff member and month, which made rows that had been under different duplicate
parents collide on the same day, and the same-day collapse then removed them.
Every distinct staff-and-date pair survives, because two rows sharing one are by
definition duplicates. Where a duplicate group disagreed about the shift, the
most recently created row won.

`verify_rebuild.sql` returned 28 of 30 PASS on the first run. Both failures were
real, and `0004` fixes them.

### Revoking from `PUBLIC` does not restrict `anon`

Every `REVOKE ALL ON FUNCTION ... FROM PUBLIC` in `0003` was ineffective. The
intent was to stop anonymous callers reaching the tier-limit functions, which are
`SECURITY DEFINER` and take an organization id as an argument. After the rebuild
they were still callable with nothing but the publishable key.

Supabase configures default privileges on schema `public` so that a function
created there is granted `EXECUTE` to `anon`, `authenticated` and `service_role`
*explicitly*. Revoking from `PUBLIC` removes only the implicit grant. Worse, the
two revokes are order-dependent: while a function's ACL is null it grants
`EXECUTE` to `PUBLIC` implicitly, and `anon` reaches it that way, so revoking
from `anon` alone does nothing either. Both are needed, `PUBLIC` first.

`custom_access_token_hook` escaped only because its revoke happened to name
`anon` directly.

The general rule for this schema: `authenticated` must keep `EXECUTE` on
everything, because policy expressions call `app_org_id()` and a policy is
evaluated as the querying role. `anon` should hold exactly the three pre-auth
invitation lookups and nothing else. `0004` also sets default privileges so the
next function added does not quietly become public again, and scopes the two
tier-limit functions to the caller's own organization so that even a signed-in
branch cannot read another tenant's headcount by passing its uuid.

### One auth-sync trigger survived

`handle_user_update`, on `on_auth_user_updated` on `auth.users`, was the last of
the machinery `0003` dismantled. It did not pin `search_path`, and it copied the
name out of auth metadata on every update of the auth row, so renaming a
principal in the app would silently revert. Dropped in `0004`.

## 0006: a branch may reassign, but must say why

The guard in `0003` forbade a branch from touching `staff_id` at all, which killed a
feature the app was built around: the assignment form offers to leave the staff
field empty so "all available staff at the outlet can take this task", and the
branch dashboard has a Take Task flow for exactly that. Verified broken against the
live database before changing anything — every attempt raised the guard's message.

The rule now, all enforced in the trigger and confirmed by impersonation:

| Attempt | Result |
| --- | --- |
| Branch claims an unowned task | allowed, no reason needed |
| Branch reassigns owned work with no reason | refused |
| Branch reassigns owned work with under 5 characters | refused |
| Branch assigns to another branch's roster member | refused |
| Branch reassigns with a real reason | allowed and recorded |
| Branch moves the deadline | still refused |
| Owner reassigns | allowed, reason optional — they are the authority |
| Anyone edits or deletes the trail afterwards | refused, no privilege exists |

`task_assignments.reassignment_reason` is write-only. The trigger copies it into
`assignment_reassignments` and blanks the column, because a PATCH that omits a
column leaves the old value in `NEW`, so keeping it would let a stale reason excuse
a later reassignment. It also means two reassignments can share identical wording,
which a "must differ from last time" check would have wrongly rejected.

The trigger is now `SECURITY DEFINER` so it can write history the client has no
privilege to write itself. `search_path` stays pinned.

## Verified by impersonation, after the hook was registered

Policies were tested by becoming each principal in SQL — `SET LOCAL ROLE
authenticated` with a hand-built `request.jwt.claims` — rather than by reading
them. Write tests ran inside a `DO` block that ends in `RAISE EXCEPTION`, so the
report comes back in the error message and nothing persists.

| Attempt | Branch | Owner | anon |
| --- | --- | --- | --- |
| Read assignments | 53 of 58, all its own | all 58 | denied |
| Read roster | 6 of 8, all its own | all 8 | denied |
| Read outlets | 1, itself | all 4 | denied |
| Read invitations / audit log | 0 | visible | denied |
| Complete own task | allowed | allowed | denied |
| Complete another branch's task | 0 rows, invisible | n/a | denied |
| Move a due date | blocked by trigger | allowed | denied |
| Reassign, or move work to another outlet | blocked by trigger | allowed | denied |
| Change own role | blocked by column grant | blocked by column grant | denied |
| Raise own plan limits | blocked | blocked, after `0005` | denied |
| Tier-limit RPC | own org only | own org only | denied |
| Invitation lookup by token | works | works | works, and must |

Two things this found that reading the policy set did not.

### An owner could raise their own plan limits

`bootstrap_organization` sets the tier and its limits itself, specifically so a
signup cannot award itself a higher plan. That was pointless while
`org_admin_update` allowed the owner to update their own organization row and
nothing narrowed which columns: `max_employees = 9999` succeeded.

Same shape as the `users.role` escalation, and the same fix — a policy chooses
the row, a grant chooses the columns. `0005` leaves the owner `name` and
`timezone` and takes the rest. It initially looked blocked only because the test
also set `subscription_tier = 'enterprise'`, which failed a check constraint; the
limit change on its own went through.

### A branch could read every schedule in the organization

`staff_profiles` is scoped to the branch but the schedule policies were scoped to
the organization, so a branch received all 16 monthly schedules when 6 of the 8
roster members were its own. It leaked other branches' shift patterns and days
off, attached to staff ids it could not resolve to names. `TeamScheduler`
iterates the roster and looks up each member, so it never used the extra rows.
After `0005` the branch sees 12 monthly and 79 daily rows, all its own, and the
owner still sees all 16 and 109.

### Remaining advisor warnings, all expected

The security advisor reports no errors. What is left is every table being visible
in the GraphQL schema to `authenticated` (that is the design; RLS scopes the
rows), the `SECURITY DEFINER` RPCs being callable by the roles they are meant for,
leaked-password protection being off, and Postgres having patches available. The
last two are dashboard settings. The `anon` exposure findings that motivated the
rebuild are gone.
