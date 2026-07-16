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
