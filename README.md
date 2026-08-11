# Task Assigner

An accountability tool for small restaurant groups. The owner writes down the
things that must happen — take the garbage out at close, check the piping for
leaks, set the mouse traps — assigns them to people on a branch roster, and gets
proof back. The point is that the owner stops being the reminder system.

Built with React 18, TypeScript, Material-UI and Supabase.

## Who logs in

There are two kinds of account, and they are both real Supabase auth users:

- **Owner (`admin`)** — sees every branch in the organization. Creates tasks,
  assigns them, enrolls staff, invites branches, reads reports. Opens onto the
  assistant at `/assistant`; the full console is one tap away at `/dashboard`.
- **Branch (`outlet`)** — one shared login per location, used on the store's
  phone or tablet. Sees only that branch's assignments and roster. Opens onto
  today's work grouped by area at `/board`, with the editable operations
  dashboard behind a button.

Each role lands where it does most of its work, rather than both landing on a
dashboard. A branch mid-shift wants the list for the station they are standing
in; an owner wants to say what needs doing without learning a form.

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
│   │   └── assistant/  The chat the owner lands on
│   ├── staff/     Branch screens: today's board, operations dashboard,
│   │              task completion, roster, performance
│   ├── auth/      Login, owner signup, invitation redemption, /setup
│   └── layout/    Shell, navigation, notifications, usage stats
├── contexts/      AuthContext — identity from JWT claims
├── lib/           Supabase client, JWT claim reader
├── services/      supabaseService.ts — all database access
└── types/         Shared TypeScript types
supabase/
├── migrations/    Numbered SQL, applied in order
├── functions/     Deno edge functions, deployed to Supabase
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

## What runs on its own

Nothing about keeping time depends on somebody having the app open. Five cron
jobs run in the database, all of them working in each organization's timezone
and all idempotent, so a retry cannot double up:

| Job | Cadence | Does |
| --- | --- | --- |
| `sweep-overdue` | every 15 min | Flips assignments past their deadline to overdue |
| `materialise-recurring` | hourly | Creates each branch's copy of a recurring task for its local today |
| `recalculate-streaks` | hourly | Rebuilds per-staff clear-board streaks |
| `notify-owner` | 4× hourly | Pushes escalations and watched-task completions |
| `send-digest` | hourly | Sends the morning summary to owners whose chosen hour has arrived |

The last two call edge functions in `supabase/functions/`. Both authenticate on
a shared secret read from the `app_keys` table rather than a user session, which
is why they run with JWT verification off — the secret check is the first thing
each of them does.

## The assistant

The owner opens onto a chat rather than a dashboard. They describe what needs to
happen in their own words, and the assistant turns it into tasks — but only after
showing them a card of exactly what it intends to create.

Three pieces, split along one line: **the model proposes, the database disposes.**

| Piece | Where | Does |
| --- | --- | --- |
| `assistant` | `supabase/functions/assistant/` | Holds the OpenAI key, calls the model, stores what it proposed |
| `confirm_chat_proposal` | migration `0019` | Turns an approved proposal into real tasks, and writes the audit row |
| `chat_conversations`, `chat_messages` | migration `0018` | History, scoped to the individual owner rather than the organization |

The edge function never writes anything but chat rows. It builds its Supabase
client from the caller's own `Authorization` header, so every read it makes is
filtered by the same row-level security the app runs under — it cannot see
anything its owner could not. Creating work is a separate, deliberate act by the
owner, and `confirm_chat_proposal` re-reads the stored proposal rather than
accepting one from the browser, so what gets created is what was on the card.

Area, shift and branch identifiers are handed to the model as JSON Schema `enum`s
under strict mode. It is therefore structurally unable to name one that does not
exist, which is the failure small models are most prone to on this kind of job.

Set `OPENAI_API_KEY` under **Edge Functions > Secrets** in the dashboard. Never in
`.env.local` — Create React App inlines `REACT_APP_*` into the browser bundle, and
these secrets are the production equivalent of a `.env` file anyway. `OPENAI_MODEL`
is optional and defaults to `gpt-5.4-mini`.

`GET /functions/v1/assistant` returns `{ ok, model, keyPresent }`, so a missing
secret is one request to diagnose rather than something that looks like the model
being broken.

## Known gaps

- The assistant answers questions from a summary of open work, not from the full
  history. Anything needing real numbers it will decline and point at Reports
  rather than guess.
- Invitations are not emailed. The owner gets a link and has to send it.
  [email-integration-setup.md](email-integration-setup.md) sketches the options.

## License

MIT.
