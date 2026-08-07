# Task Assigner

An accountability tool for small restaurant groups. The owner writes down the
things that must happen — take the garbage out at close, check the piping for
leaks, set the mouse traps — assigns them to people on a branch roster, and gets
proof back. The point is that the owner stops being the reminder system.

Built with React 18, TypeScript, Material-UI and Supabase.

## Who logs in

There are two kinds of account, and they are both real Supabase auth users:

- **Owner (`admin`)** — sees every branch in the organization. Creates tasks,
  assigns them, enrolls staff, invites branches, reads reports.
- **Branch (`outlet`)** — one shared login per location, used on the store's
  phone or tablet. Sees only that branch's assignments and roster.

**Staff do not log in.** A staff member is a roster entry belonging to a branch:
a name, an employee number, a position, a hire date, and a streak. Tasks are
assigned to roster entries, and whoever is holding the branch device records the
completion. This is why the app asks who is completing a task rather than
inferring it from the session.

A login can only be created two ways, both server-side so the role is never
chosen by the browser:

- A new owner signs up, then `bootstrap_organization` creates the organization
  and their profile.
- An owner invites a branch, naming the email address that branch will use. The
  app does not send the invitation — it shows the owner a link to pass along.
  When the branch signs up through it, `redeem_outlet_invitation` links the
  account to the outlet, and it only redeems for the address the invitation
  named, so a leaked link is not enough on its own.

If an account signs in without a profile — a confirmation email opened on
another device, say — the app routes it to `/setup` to finish one of the two
flows above.

## Features

**Tasks and assignments.** Tasks carry an estimated duration and a priority.
Assignments carry a due date and time, a status, and optionally a photo or video
proof plus completion notes. Recurring tasks can repeat daily, weekly or monthly.
Overdue assignments deduct their estimated time from the assignee's record.

**Scheduling.** A monthly view sets each staff member's days off and rest day;
a daily view sets which outlet they work and their shift times. A day marked off
cannot also carry shift data, which the database enforces.

**Accountability.** Completion proofs go to a private storage bucket and are
read back through signed URLs. Streaks track consecutive clear boards per staff
member. A leaderboard and per-staff performance view sit on top of the same data.

**Operations.** Branch invitations, subscription tiers with per-tier limits on
admins, branches and employees, CSV and PDF export of completion reports, and
in-app notifications over Supabase Realtime.

**Mobile.** Installable PWA with a service worker, direct camera capture for
proof, and touch-sized controls — it is meant to be used on a store phone.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values below
npm start
```

`.env.local` needs the project URL and anon key from
**Supabase > Project Settings > API**:

```
REACT_APP_SUPABASE_URL=https://<project-id>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon key>
```

The anon key is safe in the browser; every table is protected by row-level
security. There is no service-role key in this app and there should never be one.

For the database itself, see [supabase/README.md](supabase/README.md). The
schema is applied by one transactional migration, and the app will not work
until the access token hook described there is registered, because every policy
reads claims that only the hook can mint.

## Scripts

| Command | Does |
| --- | --- |
| `npm start` | Dev server on `http://localhost:3000` |
| `npm run build` | Production build |
| `npm test` | Test runner |
| `npm run lint` | ESLint over `src` |
| `npm run format` | Prettier over `src` |
| `npx tsc --noEmit` | Type check without emitting |

## Layout

```
src/
├── components/
│   ├── admin/     Owner screens: dashboard, tasks, assignments, staff,
│   │              outlets, invitations, schedulers, reports, leaderboard
│   ├── staff/     Branch screens: dashboard, task completion, performance
│   ├── auth/      Login, owner signup, invitation redemption, /setup
│   └── layout/    Shell, navigation, notifications, usage stats
├── contexts/      AuthContext — identity from JWT claims
├── lib/           Supabase client, JWT claim reader
├── services/      supabaseService.ts — all database access
└── types/         Shared TypeScript types
supabase/
├── migrations/    Numbered SQL, applied in order
├── legacy-sql/    Archive of the pre-migration scripts, for reference only
└── SCHEMA_NOTES.md  Why the schema is shaped the way it is
```

`src/services/supabaseService.ts` is the only module that talks to the database.
Components call it; they never build queries themselves.

## Where identity comes from

`AuthContext` reads `user_role`, `organization_id` and `outlet_id` out of the
access token, minted by a Postgres hook at sign-in. The same claims drive the
row-level security policies, so what the UI shows and what the database will
return cannot drift apart. Nothing about a user's role or organization is
supplied by the browser.

A consequence worth knowing: after any change to a user's role or outlet, that
user must sign out and back in, because their existing token still carries the
old claims.

## Known gaps

- Recurring-task materialization and the overdue sweep run in the browser, so
  they only happen while someone has the app open. Both belong in scheduled jobs.
- The scheduler knows who is off, but nothing yet reacts when a task's assignee
  turns out to be away — the owner has to notice.
- Invitations are not emailed. The owner gets a link and has to send it.
  [email-integration-setup.md](email-integration-setup.md) sketches the options.
- Completion records who the task was assigned to, not who tapped the button.
  On a shared branch device those can differ; the column exists for it.
- Two outlets in the live data have no login yet; invite them from Outlet
  Management.

## License

MIT.
