# Vriksha Product Note Studio — Implementation Roadmap

Last updated: 2026-07-16. Sequenced per user priority: compliance engine and client-facing reporting first (these two are the path to actually sending product notes to clients), then tax module, then constituent UI, then live pricing/performance, then smallcase integration.

Update the status column as phases ship. See `ARCHITECTURE.md` for the data model these phases build on.

| # | Phase | Status |
|---|---|---|
| 0 | Backend + database (Supabase migration, login, RLS) | ✅ Done |
| 1 | Compliance engine | Not started |
| 2 | Client-facing reporting | Not started |
| 3 | Tax module | Not started |
| 4 | Constituent management UI | Not started |
| 5 | Live pricing & performance tracking | Not started |
| 6 | smallcase integration | Not started |

---

## Phase 1 — Compliance Engine

**Goal**: automated checks before any rebalance/portfolio change is published. No maker-checker approval step — deliberately deferred (see decision note below).

**Decision (2026-07-16)**: maker-checker requires a second-approver role, which means a roles/permissions system that doesn't exist anywhere else in this app (today: any authenticated user can edit anything). Standing that up just for this one workflow was judged not worth the complexity right now. Revisit if/when the team grows enough that a single-approver compliance model stops being acceptable — at that point this phase's workflow will need rework, not just an add-on.

**New schema**: `portfolio_holdings`, `portfolio_holdings_history` (see ARCHITECTURE.md §2.2). This phase needs a *minimal* holdings table to exist even though the full constituent-editing UI comes later in Phase 4 — for now, holdings can be entered via a simple form or seeded from the existing CSV upload feature already in the app.

**Jurisdiction / regime handling (decision, 2026-07-16)**: not every product is subject to SEBI rules — Vriksha may run the same strategy for non-India clients under a different regime. Rather than one universal rule set, each product gets a `regulatory_regime` tag (e.g. `india_sebi`, `other`/`none` initially — extend as real non-India regimes are defined). The compliance engine looks up which checks apply to a product's regime and only runs those. A non-India product is never flagged "non-compliant" against SEBI-specific rules that were never meant to apply to it — it simply has a different (possibly empty, initially) checklist. This adds one column to `products` (or a small `product_regimes` lookup table if a product can span more than one regime) and a rules-by-regime mapping — flag as a small schema addition beyond what ARCHITECTURE.md currently lists.

**Checks to automate, scoped per regime** (pull thresholds from each product's existing note fields — e.g. `portfolioConstructionRules.singleStockCap`, `.sectorCap` — so the engine reads limits from the note rather than hardcoding them). For `india_sebi` regime:
- Single-stock concentration cap per product (varies by product, e.g. 8–10%)
- Sector concentration cap (varies by product, e.g. 25–30%)
- Risk-profile-to-allocation consistency (e.g. a "Conservative" variant shouldn't show >30% equity-like exposure)
- Weights sum to 100% (± rounding tolerance) — this one is universal, applies regardless of regime
- SEBI disclosure requirement checklist (static checklist item, human-confirmed — not all of this is mechanically checkable)

Other regimes start with just the universal checks (weights sum to 100%) until their specific rules are defined — not blocked on having every jurisdiction's rules written before this phase can ship.

**Workflow (decision, 2026-07-16 — corrected from an earlier draft of this doc)**: editing holdings is a draft action, same as editing a product note today — nothing is published or checked automatically as you type. You explicitly run "Check Compliance," which evaluates current draft holdings against the product's regime-appropriate rules and shows a simple **Compliant / Non-Compliant** status plus the specific rule-by-rule detail. Publish is a separate, explicit action you take yourself — the engine does not auto-publish on a pass. If the last check run says Non-Compliant, Publish is blocked (you must fix holdings and re-check) *for regimes where those checks are binding*. There is no maker-checker step and no override-with-reason flow (both deferred, see above) — but because checks are scoped by regime, "blocked because non-compliant" only ever means non-compliant with rules that actually apply to that product.

**UI**: new "Compliance" nav item, plus an inline "Check Compliance" action on the holdings editor itself. Shows: current draft's Compliant/Non-Compliant status with rule-by-rule detail, and a log of past checks and publishes (useful for audit even without approvals).

**Open questions**: none remaining — both prior open questions were about the maker-checker flow, which is now out of scope for this phase.

---

## Phase 2 — Client-Facing Reporting

**Goal**: auto-generated, investor-ready factsheets — distinct from the internal product notes (different tone, no internal methodology detail, no "to be finalized" placeholders visible to clients).

**Depends on**: Phase 1 for holdings data if the factsheet is meant to show live constituents; can ship without it if the first version only surfaces note-level content (objective, risk profile, benchmark) plus a "holdings available on request" line.

**Scope**:
- New export mode (alongside existing Word/Excel export) — a client-facing DOCX/PDF template, reusing `docx.js` already in the app.
- Strip internal-only fields: `taxNote` placeholders like "to be detailed in a future revision," fee placeholders marked "to be finalized," internal risk commentary not meant for clients.
- Add compliance disclaimers appropriate for investor-facing material (distinct from the current internal disclaimer already in the export).
- Likely needs a lightweight "what's client-visible" flag per field, or a maintained allowlist of which note sections go into the factsheet — simplest first version: a fixed template that only pulls specific fields (objective, risk profile, benchmark, suitability, key risks), not a general "show everything" dump.
- Send mechanism: reuse the existing mailto quick-email feature as the starting point, or build a proper send flow — ask user which before building.

**Open questions to resolve before building**:
- Should factsheets show live holdings (needs Phase 1 data) or stay at the note level (objective/risk/benchmark only) for v1?
- PDF or DOCX as the primary client deliverable? (App already has both export libraries loaded.)
- Does "send to client" mean draft-and-download for the user to send manually (safest, no new integration), or an actual send-from-app flow? Recommend draft-and-download for v1 given no email-sending infrastructure exists yet.

---

## Phase 3 — Tax Module

**Goal**: STCG/LTCG tracking per lot, REIT/InvIT distribution component split, FoF taxation — all currently explicitly out of scope in the notes ("to be detailed in a future revision").

**Depends on**: Phase 1/4 holdings data with purchase-lot-level detail (not just current weights) if per-lot STCG/LTCG is required — this may need a new `holding_lots` table (instrument, quantity, purchase_date, purchase_price) rather than fitting into `portfolio_holdings` as designed. Flag for schema revision when this phase starts.

**Scope**: replace the placeholder `taxNote` field in each product with either (a) computed tax treatment based on actual holding periods once lot data exists, or (b) a well-written static reference section per product type (equity direct, REIT/InvIT, ETF, MF/FoF) if lot-level tracking is deferred further. Recommend starting with (b) — it's immediately useful and doesn't block on Phase 4/5 schema work.

---

## Phase 4 — Constituent Management UI

**Goal**: replace CSV-upload-only with an in-dashboard portfolio builder.

**Builds on**: `portfolio_holdings` table from Phase 1 (already exists by this point).

**Scope**: instrument search/autocomplete, weight entry with real-time sum-to-100% validation, drag-and-drop sleeve rebalancing, diff view against the prior rebalance (reuse the diff UI pattern already built for product note versioning). This is the UI layer on top of a table that already exists — should be additive, not a schema change.

---

## Phase 5 — Live Pricing & Performance Tracking

**Goal**: daily prices → live NAV, drawdown, tracking error vs. benchmark, factor exposure drift.

**New schema**: `prices`, `nav_history` (see ARCHITECTURE.md §2.2).

**Scope**: a daily price ingestion job (external feed — needs a decision on data source: NSE, a paid API, manual entry as a fallback), a NAV computation job (holdings × prices → NAV, run daily), and new dashboard views for NAV chart, drawdown, tracking error. This is the first phase requiring something running on a schedule outside the browser (a cron job or Supabase Edge Function) rather than only client-side logic — flag this as new infrastructure, not just new tables.

---

## Phase 6 — smallcase Integration

**Goal**: direct API push from the dashboard to smallcase's portfolio management endpoints on publish.

**Depends on**: Phase 1 (compliance-approved holdings) and Phase 4 (constituent UI) as the source of what gets pushed. Should be the last phase — pushing to a live external platform is the highest-stakes integration and should only happen once holdings data, compliance checks, and the editing UI are all proven internally first.

**Scope**: requires smallcase API credentials/partnership terms (external dependency, not just engineering) — confirm access before scoping further.

---

## Cross-cutting notes

- Every phase that touches `portfolio_holdings` or beyond should keep the same pattern already proven in this app: a "current state" table plus an append-only "\_history" table for audit trail, exactly like `products`/`product_versions`. Don't deviate from this pattern without a specific reason.
- Any phase introducing a new external dependency (price feed, smallcase API, email sending) should get its own credentials-and-access conversation before implementation starts, the same way the Supabase setup did.
- Keep using the established silent-failure-to-visible-error pattern (guard + try/catch + explicit user-facing message) for every new integration point — this is what caught and will keep catching bugs like the CDN/boot-sequence issues already hit twice in this project.
