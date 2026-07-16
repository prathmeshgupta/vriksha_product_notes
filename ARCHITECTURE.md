# Vriksha Product Note Studio — Architecture

Last updated: 2026-07-16. This document is the system of record for how the app and its data are structured. Update it whenever a phase in `ROADMAP.md` ships — do not let this drift from what's actually deployed.

## 1. System overview

One app, one Supabase project, one GitHub Pages deployment. There is no separate "portfolio ops" app — see §3 for why.

```
Browser (index.html, single file, no build step)
   │
   │  HTTPS, via @supabase/supabase-js v2 (CDN, jsdelivr)
   ▼
Supabase project "Vriksha Product Notes" (djrzjwhqzenykzfuzfhj, ap-south-1)
   ├── Postgres (tables below)
   ├── Auth (email/password, manual account creation only)
   └── Row Level Security (any authenticated user: full read/write; no public access)
```

- **Frontend**: `index.html` — vanilla HTML/CSS/JS, no framework, no build step. Deployed via GitHub Pages from `main` branch root.
- **Repo**: `github.com/prathmeshgupta/vriksha_product_notes`, mirrored locally at the OneDrive-synced `vriksha_product_notes_repo/` folder.
- **Backend**: Supabase (Postgres + Auth). Publishable key is safe to expose client-side by design — RLS is the actual security boundary, not key secrecy.
- **Auth model**: everyone with an account can read/write everything. No roles yet (see Compliance Engine phase — this is where that changes for portfolio actions specifically, not notes).

## 2. Data model

### 2.1 Existing tables (live today)

**`products`** — the current/editable state of each product note. One row per product (9 rows today: P1–P9).

| column | type | notes |
|---|---|---|
| id | text, PK | e.g. `P1` |
| code | text | e.g. `DSOP` |
| name | text | |
| short_name | text, nullable | |
| category | text | |
| status | text | `draft` \| `published` |
| archived | boolean | default false |
| data | jsonb | the full editable note — objective, philosophy, allocation ranges, risk profile, etc. |
| created_at / updated_at | timestamptz | |
| updated_by | uuid, FK → auth.users | |

**`product_versions`** — append-only snapshot history, one row per "Publish" action. Never updated or deleted.

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| product_id | text, FK → products.id | |
| version_number | integer | unique per product |
| note | text, nullable | optional publish note |
| data | jsonb | full snapshot of `products.data` at publish time |
| created_at | timestamptz | |
| created_by | uuid, FK → auth.users | |

RLS on both: `authenticated` role can select/insert/update `products`; select/insert only on `product_versions` (no update/delete — the audit trail is immutable by design).

### 2.2 Phase 1 tables (live today, added 2026-07-16)

**`portfolio_holdings`** — current/live constituent list for a product's actual portfolio, as opposed to the note's allocation *ranges*. This is what the compliance engine checks caps against. Editing holdings is a draft action, same as editing a product note — nothing is checked or published automatically.

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| product_id | text, FK → products.id, on delete cascade | links portfolio to its note |
| instrument_code | text | ticker/ISIN |
| instrument_name | text | |
| sleeve | text, nullable | which style sleeve / asset class bucket, matches note's sleeve names |
| weight_pct | numeric, check 0–100 | current weight |
| sector | text, nullable | for sector-cap checks |
| updated_at | timestamptz | auto-updated via `set_updated_at()` trigger |
| updated_by | uuid, FK → auth.users | |

**`products.regulatory_regime`** — column on the existing `products` table, `not null default 'india_sebi'`. Values: `india_sebi`, `other`, `none` (extend as real non-India regimes get defined). Drives which compliance checks apply to that product — see §2.4. Mirrored into `products.data.regulatoryRegime` in the frontend's in-memory state so the editor can read/write it like any other note field, then synced back to the real column on every save — this is the same mirror pattern used nowhere else in the app yet, flagged here in case it causes confusion later: the column is the source of truth, `data.regulatoryRegime` is a working copy.

**`portfolio_holdings_history`** — append-only, mirrors the `product_versions` pattern. One row per "Check Compliance" run (not per rebalance/publish — a check can be run repeatedly against the same draft holdings before anything is finalized). This is both the audit log and the source Publish gating reads from (its most recent row per product).

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| product_id | text, FK → products.id, on delete cascade | |
| rebalance_number | integer | auto-incremented per product by the app (max existing + 1), unique per product |
| holdings_snapshot | jsonb | full holdings array at the moment "Check Compliance" was run |
| compliance_check_result | jsonb | `{compliant, checks: [{name, status, detail}], regime, checkedAt}` — full detail, not just pass/fail |
| approved_by | uuid, FK → auth.users, nullable | reserved for a future maker-checker approval step (deferred as of 2026-07-16 — column kept nullable/unused so it can be turned on later without a migration) |
| created_at | timestamptz | |
| created_by | uuid, FK → auth.users | |

Both tables' RLS mirrors `products`: any `authenticated` user has full select/insert/update/delete on `portfolio_holdings`; select/insert only on `portfolio_holdings_history` (no update/delete — immutable audit trail, same as `product_versions`).

### 2.3 `templates` table (live today, added 2026-07-16)

**`templates`** — archetype starting-point structures for the "Create New Product" flow. Deliberately a **separate table from `products`**, not a flag on `products`, so normal product Edit/Archive/Delete code paths can never touch template rows by accident. This was a direct fix for an earlier design smell where the 9 real products were themselves being used as "templates" — conflating live client-facing content with reusable scaffolding.

| column | type | notes |
|---|---|---|
| id | text, PK | e.g. `T1`–`T4` |
| name | text | e.g. "Single-Sleeve Equity" |
| description | text, nullable | shown in the Create screen to help the user pick the right archetype |
| archetype | text | machine-readable tag: `single-sleeve` \| `strategic-allocation` \| `risk-variant` \| `goal-based` |
| data | jsonb | placeholder note content matching the shape a real product of that archetype would have — same field names as `products.data` (e.g. `styleSleeves`, `variants`, `portfolioConstructionRules`), pre-filled with `null` cap values and instructional placeholder text, not real numbers |
| created_at / updated_at | timestamptz | |
| updated_by | uuid, FK → auth.users | |

RLS mirrors `products`: any `authenticated` user has full select/insert/update/delete. This is deliberately *not* more restrictive than `products` — the separation here is about code-path isolation (see above), not access control; the app has no per-user permission model anywhere yet.

Seeded with 4 starter archetypes as of 2026-07-16: Single-Sleeve Equity (T1, mirrors P1's shape), Strategic Allocation (T2, mirrors P2's shape), Risk-Profiled Variants (T3, mirrors P3/P4/P7/P8's shape), Goal-Based (T4, mirrors P5/P6/P9's shape). All use the current numeric cap-field structure (`sleeveMinPct`/`sleeveMaxPct`/`positionMinPct`/`positionMaxPct`/`positionBasis`/`sectorCapMaxPct`) so products created from a template inherit the correct field shape from day one — no separate migration needed for template-sourced products.

Managed via a dedicated "Manage Templates" screen (create/edit/delete), kept entirely separate from the product Edit screen's code paths — see ROADMAP.md for build status.

### 2.4 Compliance rules are scoped by regime, not universal (implemented 2026-07-16)

A single global rule set was rejected because not every product answers to SEBI — Vriksha may run the same underlying strategy for non-India clients under a different regulatory regime, and it would be wrong to mark that product "non-compliant" against rules it was never subject to. `products.regulatory_regime` (§2.2) determines which checks the compliance engine runs:

- `india_sebi`: single-stock cap, sector cap, risk-profile-to-allocation consistency (Conservative variants only, flagged as manual-confirm), SEBI disclosure checklist (manual-confirm) — plus the universal weights-sum-to-100% check.
- other regimes: just the universal weights check until that regime's specific rules are defined; not blocked on every jurisdiction being fully specified before Phase 1 can ship.

This mapping (regime → which checks apply, and their thresholds) lives in application logic (`runComplianceCheck()` / `getEffectiveCapThresholds()` in `index.html`), reading limits from each product's existing note fields — `portfolioConstructionRules.positionMaxPct` / `.sectorCapMaxPct`, or the tightest of the per-sleeve/per-variant equivalents when a product uses those instead — rather than being hardcoded or duplicated into a separate rules table. Revisit as a proper `compliance_rules` table only if the mapping outgrows what's comfortable to keep in code.

Each check reports one of four statuses, not just pass/fail: `pass`, `fail`, `no-data` (nothing to check against — e.g. no cap is set on the note), or `manual` (human-confirm item, e.g. the SEBI disclosure checklist). A product is Compliant overall only if every check with a mechanical result is `pass`; `no-data` and `manual` items never block on their own.

**`prices`** (needed from Phase 4 — Live Pricing & Performance)

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| instrument_code | text | |
| price_date | date | |
| close_price | numeric | |
| source | text | e.g. `nse`, `manual` |

Unique constraint on `(instrument_code, price_date)`. Daily granularity only — no intraday/tick data, to keep row counts sane long-term.

**`nav_history`** (needed from Phase 4)

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| product_id | text, FK → products.id | |
| nav_date | date | |
| nav_value | numeric | computed from holdings × prices |
| drawdown_pct | numeric, nullable | |
| tracking_error_bps | numeric, nullable | vs. benchmark |

Unique constraint on `(product_id, nav_date)`.

## 3. Why one app, not two

The alternative considered was a separate "portfolio ops" app hitting the same Supabase project. Rejected because:

- It doesn't reduce database size or row count — same Postgres instance either way. The actual bloat risk is **unbounded time-series growth** (daily prices, NAV history), which is solved by table design (daily-only granularity, no tick data) and retention discipline, not by splitting the frontend.
- Two apps means two URLs, two login screens, two codebases to keep in sync, and two places for the class of bug we just fixed (CDN/boot-sequence issues) to independently occur.
- A portfolio's holdings are meaningless without their product note for context (objective, risk profile, caps) and vice versa — keeping them in one app with one login makes the `product_id` foreign key do the linking work for free. Splitting them just recreates a manual sync problem across two systems.

Capacity check: Supabase free tier is 500MB. Current usage is trivial (9 product rows + JSONB). Even at scale — 9 products × ~20 holdings × daily prices for several years — that's tens of thousands of numeric rows, comfortably within free-tier limits for years. Size was never the real constraint; coupling and workflow separation are handled at the table/RLS level instead (see §4).

## 4. Where real separation *does* matter

Even within one app/database, some things should NOT share a table or a casual edit workflow:

- **Note content vs. portfolio holdings**: different tables (`products.data` vs `portfolio_holdings`) so editing prose doesn't touch live holdings and vice versa.
- **Casual edits vs. audit-grade actions**: publishing a product note is single-user, immediate. Running a compliance check is also single-user/immediate (automated checks only, no maker-checker — deferred as of 2026-07-16 to avoid standing up a roles system for one workflow), and Publish is blocked with an override-confirm — not a hard stop — when the last check is Non-Compliant. Every check still writes through the same append-only `_history` pattern (`portfolio_holdings_history`) so the audit trail exists regardless of whether a second approver or a hard block is required later.
- **Human-edited data vs. machine-fed data**: `prices` will eventually be populated by an automated feed, not manual entry — that's a different write pattern (frequent, external, no human review) from everything else in this app, so it gets its own ingestion path even though it lives in the same database.

## 5. Known limitation: single-file architecture and modularity

**Status (2026-07-16): flagged for future attention, not yet addressed.** The entire frontend — layout, styling, editor logic, versioning, exports, boot sequence, and now PDF generation — lives in one HTML file with one inline `<script>` block (170KB+ as of this note). This was a deliberate original choice (no build step, trivial to deploy via GitHub Pages, easy to reason about early on), but it has real costs that are already showing up:

- Every edit touches a file large enough that basic verification (syntax check, tag balance, diffing) has to be done defensively every time, and this session hit genuine file-truncation/sync bugs purely as a function of size and edit frequency — not because of anything wrong with the underlying logic.
- There's no separation between things that change often (product content, UI tweaks) and things that should be stable infrastructure (auth boot sequence, export engines, the compliance rules engine once built) — everything is equally easy to accidentally break.
- As more phases ship (compliance engine, holdings UI, live pricing, smallcase integration), this file will keep growing, and the risk/friction of each change grows with it.

**This is not being fixed now** — re-architecting into modules (e.g. separate JS files for data layer / editor / exports / compliance, or a lightweight build step) is a real project in its own right and would compete with actual feature work. Recorded here so it isn't lost, and so any future "let's split this up" conversation starts from an accurate picture of why it matters: not aesthetics, but reducing the real risk of accidental breakage as the app keeps growing, and making it easier to add/remove/swap self-contained pieces (like archetype templates, export formats, or entire phases) without touching unrelated code.

**When to revisit:** a natural trigger point is the start of Phase 4 (Constituent Management UI) or Phase 5 (Live Pricing), since both add meaningfully-sized new subsystems — worth reassessing then whether the single-file approach still holds up, rather than waiting until it becomes actively painful.

## 6. Deployment / ops notes (unchanged from README, restated here for completeness)

- No realtime collaborative editing — last write wins. Use Refresh before editing.
- No role-based permissions today, and this does not change in the Compliance Engine phase — maker-checker was considered and explicitly deferred (2026-07-16) to avoid introducing a roles system for a single workflow. Compliance checks are automated and immediate; there is no second-approver step yet.
- No public signup — accounts created manually via Supabase dashboard.
- Treat the Supabase project as the system of record. This repo is just application code.
