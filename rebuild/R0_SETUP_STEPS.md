# R0 scaffold — commit and push steps

The verified R0 scaffold has been staged at `rebuild/scaffold/` in this repo folder (on your machine, via OneDrive sync). It needs to be committed and pushed from your machine, not from the sandbox — the sandbox's local git state for this repo has drifted (confirmed 2026-07-16: showed a corrupted branch name and "no commits yet" despite `origin/rebuild` having history), so all git operations should continue to run from your own terminal, same as every other commit this project.

## What's in `rebuild/scaffold/`

A working Vite + React 19 + TypeScript (strict) + ESLint scaffold, verified in the sandbox to:
- `npm run dev` — Vite dev server starts and serves the app (HTTP 200 confirmed)
- `npm run build` (`tsc -b && vite build`) — TypeScript strict-mode build passes with zero errors
- `npm run lint` — ESLint passes with zero errors
- Folder structure matches `rebuild/ARCHITECTURE.md` §3 (`src/design-system/`, `src/data/`, `src/features/*`, `src/hooks/`, `src/utils/`)
- Supabase client (`src/data/supabaseClient.ts`) wired to read `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from Vite env vars, pointed at the real project (`djrzjwhqzenykzfuzfhj`) — same URL/key the frozen app uses, confirmed live via the Supabase API directly (not reachable from inside the sandbox, which has no network path to `supabase.co` — this is a sandbox limitation, not a problem with the credentials or code)
- `scripts/smoke-test-supabase.mjs` — run this yourself once (`node scripts/smoke-test-supabase.mjs` after `npm install`) to confirm the Supabase connection works from your machine

**Tooling decision made during R0** (see `rebuild/ROADMAP.md` R0 section for full reasoning): the default Vite 8 scaffold's `oxlint` and Vite's newer Rust-native build (rolldown/oxc) both crashed with a SIGBUS error in the sandbox used to build this. Worked around by pinning `vite` to `^5.4.11` and using ESLint instead of `oxlint`. This should not affect you running it locally — Vite 5.4 is a fully supported, stable release — but flagging it in case the same crash ever shows up on your machine, so you know it's a known, already-diagnosed issue and not something new.

## Steps (run locally, in the repo folder)

```powershell
cd path\to\vriksha_product_notes_repo
git checkout rebuild
git pull origin rebuild
```

Move the scaffold contents from `rebuild/scaffold/` to the repo root of the `rebuild` branch checkout (this is a **separate checkout state** — since `rebuild` branch should contain the app at the repo root, not nested under `rebuild/scaffold/`; the nested location was just a safe staging spot):

```powershell
# from the repo root, on the rebuild branch
robocopy rebuild\scaffold . /E /XD node_modules
```

(`robocopy ... /E` copies all files and subfolders including empty ones; adjust if you use a different OS — on Mac/Linux, `cp -r rebuild/scaffold/. .` from the repo root works the same way.)

Then clean up the now-empty staging folder and the planning docs that should stay in `rebuild/` (not get overwritten):

```powershell
Remove-Item -Recurse rebuild\scaffold
```

Verify `rebuild/STRATEGY.md`, `rebuild/ROADMAP.md`, `rebuild/ARCHITECTURE.md`, and this file are still present at `rebuild/` after the copy (they should be — `robocopy`/`cp` only adds files from the source, doesn't touch destination files with different paths).

Install and verify locally before committing:

```powershell
npm install
npm run dev       # Ctrl+C once you've confirmed it starts
npm run build
npm run lint
```

Copy `.env.example` to `.env.local` if it isn't already present (it's git-ignored, won't come through the copy if you're copying via git-aware tools, but will via robocopy/cp — check it has real values, not placeholders, before running the smoke test):

```powershell
node scripts/smoke-test-supabase.mjs
```

Once all of the above pass locally, commit:

```powershell
git add -A
git commit -m "R0: project scaffold (Vite+React+TS strict+ESLint), folder structure, Supabase client wiring"
git push origin rebuild
```

## After this is done

Update `rebuild/ROADMAP.md`'s R0 status line to "Done" and move to R1 (design tokens + component library) — see `rebuild/ROADMAP.md` for the full R1 scope.
