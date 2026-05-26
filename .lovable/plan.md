## Problem

`.env` was committed to the repo before `.gitignore` was set. Git kept tracking it even after `.gitignore` listed it.

## Fix Applied

1. `.env` deleted from GitHub via web UI (by repo owner).
2. `.env.example` remains tracked as the public template.
3. `.gitignore` already includes `.env` (line 22).

## Result

`.env` is no longer in the repository. `.env.example` provides the template for local setup.

