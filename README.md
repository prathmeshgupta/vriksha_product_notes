# Vriksha Product Note Studio

Internal tool for drafting, editing, versioning, and publishing product notes for Vriksha's discretionary and systematic portfolio products, ahead of launch on smallcase.

## Live app

Once GitHub Pages is enabled on this repo (Settings → Pages → Deploy from branch → `main` / root), the app will be live at:

`https://<your-github-username>.github.io/vriksha_product_notes/`

## Architecture

- **Frontend**: single self-contained `index.html` (no build step, no server) — HTML/CSS/vanilla JS.
- **Backend**: [Supabase](https://supabase.com) (Postgres + Auth), project `Vriksha Product Notes` (region: `ap-south-1`, Mumbai).
  - `products` table — one row per product note, holding the live/current editable state as JSONB.
  - `product_versions` table — append-only snapshots taken on "Publish," forming the audit trail.
  - Row Level Security: any authenticated (logged-in) user can view and edit all product notes. No public/anonymous access.
- **Auth**: Supabase Auth, email/password. There is no public self-serve signup — team member accounts must be created manually via the Supabase dashboard (Authentication → Users → Add User).

## Adding a team member

1. Go to the [Supabase dashboard](https://supabase.com/dashboard) → this project → Authentication → Users.
2. Click "Add User," enter their email and a temporary password.
3. Share the login URL and temporary password with them directly (not through this repo). Ask them to change their password on first login if you want — password reset UI isn't built yet, so for now, resets are also handled by you from the same dashboard screen.

## What this does NOT do (by design, for now)

- No real-time collaborative editing — if two people edit the same product at once, the last save wins. Use the "↻ Refresh" button to pull the latest before editing.
- No role-based permissions — every logged-in user can edit every product note.
- No public signup page.
- No password-reset flow in the app itself.

These are documented gaps, not oversights — they can be added later without a rewrite if the team grows or the access model needs to tighten.

## Local development / editing this file

This is a single static HTML file. To test changes locally, just open `index.html` in a browser — no build step. To deploy a change, commit and push to `main`; GitHub Pages will redeploy automatically within a minute or two.

## Data ownership note

All product note content lives in Supabase, not in this repo. This repo only contains the application code. Deleting or losing this repo does not delete any product data — but losing the Supabase project would. Treat the Supabase project as the actual system of record; back it up periodically via Supabase's own dashboard (Database → Backups) or by exporting table data.

## Working agreement for Claude sessions on this project (added 2026-07-16)

This section exists because of a real problem hit during the Phase 1 build: working documents (architecture notes, roadmap updates, git recovery instructions) were repeatedly drafted in Claude's private scratchpad folder (`.../local-agent-mode-sessions/.../outputs`) instead of this repo. That folder is invisible to the user and cleared between sessions — so anything important left there is effectively lost or, worse, becomes a stale duplicate that silently drifts out of sync with the real copy in this repo (this happened at least twice with `ARCHITECTURE.md`/`ROADMAP.md`). The user correctly flagged this as a likely contributor to some of this project's sync/confusion issues, not just a tidiness complaint.

**Rule going forward: default to this repo folder, not the scratchpad, for anything that isn't purely disposable.**

Concretely:
- Any file with a name, a stated purpose, or that gets referenced from another document (docs, instructions, recovery steps, decision records, exported data) is written directly into this repo folder (or the broader `Vriksha` OneDrive folder if it doesn't belong in git). Not drafted in the scratchpad "for now" with a plan to copy it over later — that second step is exactly what got skipped in practice.
- The scratchpad is only for genuinely throwaway intermediate work: a one-off syntax check, a diff being eyeballed mid-edit, an extraction step that gets merged and discarded within the same turn, or draft iterations on something not yet ready to be "real" (e.g. early exploratory HTML mockups before a production app existed).
- The judgment call of "is this important enough to be visible" should not be made by guessing at content — since the user never sees the scratchpad, there's no way to know later whether something mattered. So the default should be permissive toward the repo, not the scratchpad: when in doubt, save it where the user can see it.
- At the start of any new session on this project, read this README and the current `ARCHITECTURE.md`/`ROADMAP.md` in this repo folder first — these are the system of record for what's been decided and built. Do not trust or reference anything found only in a scratchpad path from a prior session.
- If a file ends up drafted in the scratchpad by mistake, copy it into this repo folder as soon as that's noticed — don't leave two copies to drift.
