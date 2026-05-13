## Problem

The Settings page (`/app/settings`) is missing the **Account ID** section. Guardians need this UUID to link to a wearer (paste it on `/guardian` → `+`), but currently there's no way for the wearer to see or copy it.

## Plan

Edit `src/routes/app.settings.tsx` to add a new "Pairing" group above the SAFETY section:

- A card showing the label **"Your Account ID"** with the user's UUID (`profile.id` / `user.id` from `useAuth()`).
- Display the UUID in a monospace font, truncated/wrapped nicely on mobile.
- A **Copy** button (using `navigator.clipboard.writeText`) with a toast confirmation ("Copied to clipboard").
- Short helper text: *"Share this with your Guardian so they can monitor you."*
- Only show this card when the current user has the `user` role (not for guardians).

No backend, schema, or auth changes needed — just a small UI addition using existing `useAuth()` context and the existing `glass` card styling so it matches the rest of Settings.

## Technical notes

- File: `src/routes/app.settings.tsx`
- Imports to add: `Copy` icon from `lucide-react`, `toast` from `sonner` (already used elsewhere), `useAuth` from `@/lib/auth`.
- Place the new section as the first group in the settings list so it's immediately visible.
