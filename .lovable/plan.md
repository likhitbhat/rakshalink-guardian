## Problem

`.env` is listed in `.gitignore`, but it was committed to the repo before being ignored. Git keeps tracking already-committed files even if they later match `.gitignore`. That's why it still shows up on GitHub.

`git ls-files` confirms `.env` is currently tracked.

## Fix

1. Untrack `.env` from git without deleting the local file:
   ```
   git rm --cached .env
   ```
   The file stays on disk (Lovable Cloud still needs it locally), but git stops tracking it.

2. On the next sync, GitHub will record a commit that deletes `.env` from the repo. From then on, `.gitignore` will keep it out.

3. Keep `.env.example` tracked as the public template (already in place).

## Important caveat

Removing the file from the latest commit does **not** purge it from git history. Any secrets that were ever in `.env` are still visible in older commits on GitHub and should be considered compromised. Recommended follow-up:

- Rotate every secret that was in `.env` (Supabase keys via the Cloud key-rotation flow, Twilio auth token in the Twilio console, Google Maps key in Google Cloud, etc.).
- If you want history scrubbed too, that requires a force-push history rewrite (e.g. `git filter-repo`) — let me know and I can walk through it, but it's disruptive for anyone else with a clone.

## Scope

Single command run against the repo. No app code changes.
