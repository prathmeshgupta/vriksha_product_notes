# Vriksha Product Note Studio — Rebuild Strategy

Last updated: 2026-07-16. This document answers "why are we rebuilding, and what does success look like" — the roadmap (`ROADMAP.md` in this folder) answers "in what order," and the architecture doc (`ARCHITECTURE.md` in this folder) answers "how, technically." Read all three before writing code; they are meant to be reviewed and corrected before implementation starts, not written once and forgotten.

## 1. Why this rebuild exists

The original app (`index.html` at the repo root, now frozen — see `PROJECT_HISTORY.md` at the repo root for its full history) grew to roughly 180KB of inline JavaScript in a single file, with no build step, no modules, and no automated tests. That was a reasonable and deliberate choice early on — no build step meant trivial deployment via GitHub Pages and easy reasoning about a small app. It stopped being reasonable once the app reached Phase 1 (Compliance Engine): every edit that session required manual, defensive verification — grepping every call site by hand, running independent subagent re-reads of the whole file — to catch bugs a compiler or test suite would normally catch automatically. Four more major phases are planned (client-facing reporting, tax module, a significantly larger constituent-management UI, and live pricing/performance tracking with a scheduled backend job), and the risk of a silent regression per change was judged likely to keep climbing, not plateau.

This is infrastructure supporting real financial product notes for real clients. The cost of a silent bug here is not hypothetical.

## 2. What "done" looks like

The rebuild is successful when:
- Every feature currently live in the frozen app (product note editing, versioning/publish/audit trail, Word/Excel/PDF export, CSV constituent upload, archive/unarchive, Create-from-blank/template/existing, Manage Templates, the Phase 1 Compliance Engine) is re-implemented and verified working in the new codebase.
- The new codebase has: real modules (not one file), TypeScript types for every data shape that crosses a boundary (Supabase rows, product note JSON, compliance check results), and at least basic automated tests for the logic that most needs to not silently break (compliance checks, cap-threshold extraction, export formatting).
- A real component library exists, built from the current app's proven Vriksha design palette, so every future screen composes existing components instead of re-deriving markup by hand.
- The new app has been running in parallel with (or has fully replaced) the frozen app long enough to be trusted, with no data-loss incidents.

## 3. What does NOT change

To keep this rebuild scoped and avoid it becoming an excuse to re-litigate settled decisions:

- **The Supabase project is the same project** (`djrzjwhqzenykzfuzfhj`, "Vriksha Product Notes"). No new backend, no data migration between systems — the rebuild is a new frontend (and later, new Edge Functions) against the same tables. This directly reuses the schema and RLS decisions already made and documented in the frozen app's `ARCHITECTURE.md`.
- **The business logic already proven in the frozen app is the reference implementation, not a blank slate.** Compliance check logic, cap-threshold extraction, the regime-scoping model, the versioning/publish workflow — these were built, discussed, and refined carefully with the user across multiple rounds of feedback. The rebuild re-implements them in a better-structured way; it does not redesign them from scratch unless a specific problem is found. Re-reading `PROJECT_HISTORY.md` and the frozen app's `ARCHITECTURE.md`/`ROADMAP.md` before re-implementing any given feature is mandatory, not optional.
- **The design palette does not change.** Forest-green/gold Vriksha color scheme, Lora (serif) + JetBrains Mono (monospace) typography, the existing card/button/status-pill visual language — these are proven and liked. The rebuild's component library encodes this palette faithfully; it is not an opportunity for a visual redesign.
- **No maker-checker / roles system** — this was deliberately deferred in the frozen app for a specific, documented reason (see `PROJECT_HISTORY.md` §3) and that reasoning still holds. Not being added in the rebuild unless the user explicitly revisits this decision.

## 4. Tech stack (decided 2026-07-16, see conversation history for the full reasoning)

- **React + TypeScript + Vite.** Framework chosen over vanilla-JS-plus-build-step specifically because: (a) the user is not writing the code themselves, so framework learning curve is not a cost to them; (b) a real design system/component library, encoded once, compounds in value across every future phase — especially Phase 4 (constituent UI) and Phase 5 (live pricing/charts), which are exactly the kind of complex, stateful, interactive UI frameworks are built for; (c) React specifically (over Vue or others) for its larger ecosystem of pre-built components (tables, drag-and-drop, charting) that reduce custom code needed for the trickiest upcoming screens.
- **Supabase** stays the backend (Postgres + Auth + RLS), same project, same tables plus whatever new tables future phases need.
- **Supabase Edge Functions** are the answer to any future server-side/scheduled logic (Phase 5 price ingestion, potential smallcase webhooks, CRM sync jobs) — chosen because it's free at the scale needed and already part of the existing stack, avoiding new infrastructure to manage. Not being built now; the decision is locked in so it doesn't need to be re-litigated when Phase 5 starts.
- **GitHub Pages** stays the deployment target. **Resolved 2026-07-16**: GitHub Pages serves whatever branch is configured in Settings → Pages — currently `main` (the frozen app) — and switching that setting is a fast, reversible dropdown change, not a rebuild or a git operation. This means there is no real deployment risk during R0-R7: the rebuild is developed and previewed entirely locally (`npm run dev`), only ever pushed to the `rebuild` branch, and Pages configuration is not touched until the user explicitly approves cutover at R8 — at which point switching the Pages source (or merging `rebuild` into `main`) is the entire "deploy" step. See `ARCHITECTURE.md` §1 for detail.

## 5. Where this lives

Development happens on the `rebuild` branch of the existing `vriksha_product_notes` repo (not a new repo) — branched from `main` at commit `f1ceb79` (the frozen app's final state). Keeping one repo means shared history and no duplicated tooling/access setup while both versions exist side by side. A separate repo may make sense later, once the rebuild is close to fully replacing the frozen app — that's an explicit future decision, not a default.

The rebuild's own planning docs (this file, `ROADMAP.md`, `ARCHITECTURE.md` in this `rebuild/` folder) exist so a future session — or a different person — can pick this up with full context, per the working-agreement documented in the repo root `README.md`: real project documents belong in the repo, not a scratchpad, and should be read before work resumes.

## 6. Explicit non-goals for this rebuild (for now)

- Not migrating to a different backend/database.
- Not redesigning the visual language.
- Not adding maker-checker/roles.
- Not building any Phase 5+ server-side logic yet — only deciding the tool (Edge Functions) in advance.
- Not deciding "framework vs. vanilla" per-screen going forward — that question is closed; the whole app is React from here.
