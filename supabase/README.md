# Database

## How this directory works

```
supabase/
  migrations/        Ordered, idempotent migrations. This is the source of truth.
  legacy-sql/        The ~148 ad hoc scripts from the repo root. Reference only.
  SCHEMA_NOTES.md    Verified live state and the findings that drive the migrations.
  verify_schema.sql  Read-only. Re-run after each migration to confirm the result.
```

Migrations are numbered and applied in order. Nothing outside `migrations/` should
ever be run against the database again.

## State

`0001_baseline_schema.sql` was verified against the live database on 2026-08-06
and now transcribes it exactly, including the parts that are wrong. It is a
record, not a recommendation. Read [SCHEMA_NOTES.md](SCHEMA_NOTES.md) before
changing anything.

**Two findings need attention before this app is exposed to anyone outside your
own staff:** any signed-in user can promote themselves to admin of any
organization, and anyone holding the anon key can read every invitation token.
`0002` closes both. A third — every task assignment being readable across
tenants — cannot be closed until staff have real logins, for reasons explained in
SCHEMA_NOTES.md.

**Separately, ten of the twelve staff and outlet profiles have no login at all.**
Only three accounts can sign in. That is a product problem as much as a security
one, and it is also in SCHEMA_NOTES.md.

## Migration order

| File | Purpose | Status |
| --- | --- | --- |
| `0001_baseline_schema.sql` | Verified transcription of the pre-rebuild state | Written |
| `0002_hotfix_privilege_escalation.sql` | Close the two exploitable holes without touching anything else | Written |
| `0003_rebuild.sql` | The whole rewrite, in one transaction | Written |

`0001` is a record, not something to run against the live database — it already
matches it.

`0002` exists for the case where you want the security holes closed today and the
rebuild later. It needs no data migration and no client work beyond the
`invitationsAPI` change already in the tree.

`0003` supersedes `0002` and stands alone. If you are applying the rebuild now,
skip `0002`.

## Applying the rebuild

1. Back up the database.
2. Read the header of `0003_rebuild.sql` and the client-change list in
   [SCHEMA_NOTES.md](SCHEMA_NOTES.md). The rebuild is intentionally not backward
   compatible; the unsafe client paths are meant to start failing. The matching
   client changes are already in the working tree, so deploy the two together.
3. Set the organization timezone in section 11 if the business is not in
   Asia/Manila.
4. Run the file. It is one transaction with preflight assertions, so it either
   applies completely or leaves the database untouched.
5. Register the access token hook: **Authentication > Hooks > Customize Access
   Token**, pointing at `public.custom_access_token_hook`. Nothing works until
   this is done — every policy reads claims only the hook can mint.
6. Sign everyone out and back in. Existing tokens carry no claims.
7. Run [verify_rebuild.sql](verify_rebuild.sql). Every row should read PASS.
8. Regenerate the client types:
   `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts`.

## Before applying anything

Take a logical backup. The database is small — 58 assignments, 14 users, 174
schedule rows — so this costs nothing and the migrations touch authentication.

## The legacy scripts

`legacy-sql/` holds the original root-level files, kept for archaeology only.

| Directory | Count | Notes |
| --- | --- | --- |
| `rls-attempts/` | 54 | Superseded. The recursion they fought is caused by policies on `users` that query `users`; the deployed workaround was `SECURITY DEFINER` helpers, and `0003` removes the need entirely. |
| `diagnostics/` | 39 | Pure `SELECT` scripts. Safe, and safe to delete. |
| `data-patches/` | 21 | Target specific real records. Contain the production data noted below. |
| `schema/` | 14 | Folded into `0001`. |
| `triggers/` | 12 | Reconciled in `0002` and `0003`. |
| `rls-disable/` | 8 | Destructive to security. Never run again. |

Three scripts delete from `auth.users` and would cause real data loss if run by
accident: `cleanup_custom_auth.sql`, `fix_duplicate_users.sql`, and
`auto_create_auth_users_for_credentials.sql`.

Several contain production data that should not be in a repository that might
ever go public: a real email address in `fix_cucina_mabini_role.sql`, real outlet
and user UUIDs across many `fix_*` and `debug_*` files, and the organization
names "Cucina Ilocana" and "Cucina Mabini". The baseline deliberately seeds no
organization for this reason.
