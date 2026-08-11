# Restore Supabase connection (fix login "Failed to fetch")

## What's wrong

Login in the preview fails with `TypeError: Failed to fetch`. The network tab
shows auth requests going to `https://placeholder-project.supabase.co/...` —
a **non-existent fallback host** that the Supabase client only uses when the
real env vars are missing.

Root cause (confirmed by reading `.env`):
- `.env` contains only the two Google Maps connector keys.
- All Supabase variables are gone:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
  - `SUPABASE_URL` (server-side fallback)
  - `SUPABASE_PUBLISHABLE_KEY` (server-side fallback)

The Lovable Cloud backend itself is healthy — this is purely a missing-`.env`
problem, not a backend outage.

## The fix

1. **Restore the Supabase variables to `.env`** using the project's managed
   values (project ref `xxkioqjbpbvrntnwxjyl`):
   ```
   VITE_SUPABASE_URL=https://xxkioqjbpbvrntnwxjyl.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_zrh6y6UEsKrJrb0zAhZkyg_h1fbcQ_R
   VITE_SUPABASE_PROJECT_ID=xxkioqjbpbvrntnwxjyl
   SUPABASE_URL=https://xxkioqjbpbvrntnwxjyl.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_zrh6y6UEsKrJrb0zAhZkyg_h1fbcQ_R
   ```
   (Keep the existing Google Maps keys untouched.)

2. **Restart the dev server** so the Vite build picks up the new env vars
   (Vite inlines `VITE_*` at build time).

3. **Verify** the login page can reach the real backend:
   - Confirm the preview no longer targets `placeholder-project.supabase.co`.
   - Confirm a password sign-in attempt returns a Supabase auth response (not
     a network `Failed to fetch`).

## Why this keeps happening

The `.env` has lost its Supabase keys several times this session. `.env` is
auto-managed by Lovable Cloud and normally shouldn't be edited by hand, but
it appears the Supabase block keeps getting dropped (possibly overwritten
during a re-sync). After restoring, I'll leave `.env` alone unless a later
cloud re-sync strips the keys again — at which point re-adding them is the
only remedy, since the app cannot run without them.

## Scope

No code changes. Only `.env` is touched, plus a dev-server restart.
