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

### 2.2 New tables (to be added, one phase at a time — see ROADMAP.md)

These are **planned**, not yet created. Each is added in the phase that needs it, not all at once, so the schema grows only as fast as the app does.

**`portfolio_holdings`** (needed from Phase 1 — Compliance Engine)
Current/live constituent list for a product's actual portfolio, as opposed to the note's allocation *ranges*. This is what the compliance engine checks caps against.

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| product_id | text, FK → products.id | links portfolio to its note |
| instrument_code | text | ticker/ISIN |
| instrument_name | text | |
| sleeve | text, nullable | which style sleeve / asset class bucket, matches note's sleeve names |
| weight_pct | numeric | current weight |
| sector | text, nullable | for sector-cap checks |
| updated_at | timestamptz | |
| updated_by | uuid, FK → auth.users | |

**`portfolio_holdings_history`** (Phase 1, append-only, mirrors `product_versions` pattern)
One row per rebalance event — snapshot of the full holdings set at that point, for audit trail and diffing.

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| product_id | text, FK → products.id | |
| rebalance_number | integer | unique per product |
| holdings_snapshot | jsonb | full holdings array at time of rebalance |
| compliance_check_result | jsonb | pass/fail + details from the compliance engine at publish time |
| approved_by | uuid, FK → auth.users, nullable | maker-checker: who approved |
| created_at | timestamptz | |
| created_by | uuid, FK → auth.users | |

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
- **Casual edits vs. audit-grade actions**: publishing a product note is single-user, immediate. Publishing a *rebalance* (once the compliance engine exists) should require the maker-checker flow — a different, stricter code path even though it's the same app.
- **Human-edited data vs. machine-fed data**: `prices` will eventually be populated by an automated feed, not manual entry — that's a different write pattern (frequent, external, no human review) from everything else in this app, so it gets its own ingestion path even though it lives in the same database.

## 5. Deployment / ops notes (unchanged from README, restated here for completeness)

- No realtime collaborative editing — last write wins. Use Refresh before editing.
- No role-based permissions today. This changes specifically for portfolio/rebalance actions in the Compliance Engine phase (maker-checker), not for product notes.
- No public signup — accounts created manually via Supabase dashboard.
- Treat the Supabase project as the system of record. This repo is just application code.
