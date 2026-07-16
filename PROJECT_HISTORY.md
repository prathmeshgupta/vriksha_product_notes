# Vriksha Product Note Studio — Project History

Last updated: 2026-07-16. This is the narrative record of what was built, in what order, and why — meant to be readable by someone with no prior context. For current system design, see `ARCHITECTURE.md`. For what's planned next, see `ROADMAP.md`. For day-to-day operator instructions (adding a team member, local dev), see `README.md`.

**Status as of this writing: this application (the single-file `index.html` version, described below) is FROZEN.** No new features will be added to it. It remains live and in use. All new development is happening in a separate rebuild — see "The freeze and rebuild decision" at the end of this document.

## 1. What this app is

An internal tool for Vriksha's wealth management team to draft, edit, version, publish, and export "product notes" — structured documents describing each of the firm's discretionary and systematic portfolio products (objective, philosophy, risk profile, allocation ranges, caps, fees, tax treatment, key risks) ahead of launching those products on the smallcase platform. Nine real products (P1–P9) were seeded at launch, spanning four structural "archetypes": single-sleeve equity, strategic multi-asset allocation, risk-profiled variants (Aggressive/Moderate/Conservative), and goal-based glide paths.

## 2. Build history, chronological

### Phase 0 — Static prototype (pre-Supabase)
Built as a single static HTML file with product data hardcoded in JS, no login, no persistence beyond browser localStorage. Included the first versions of the Word/Excel export logic. This phase proved out the UI/UX and document-generation approach before any backend existed. Superseded entirely — a snapshot of these early files is kept in `scratchpad_backups/2026-07-16_202522/` for reference only (not current).

### Phase 0 → Production — Supabase backend + auth
Migrated from localStorage to a real Postgres backend via Supabase: `products` table (current/editable state as JSONB) and `product_versions` table (append-only publish snapshots). Added email/password login via Supabase Auth, manual account creation only (no public signup). Row Level Security: any authenticated user can read/write everything — no per-user permission model. Deployed via GitHub Pages from this repo's `main` branch.

**Incident — infinite loading spinner**: after an early fix, the app got stuck on a permanent loading spinner in production. Root cause: `SyntaxError: Identifier 'supabase' has already been declared` — a locally-declared `supabase` variable collided with the Supabase CDN library's own global `window.supabase`. Fixed by renaming the local client variable to `sb` throughout the codebase. This is why every Supabase call in the code reads `sb.from(...)` rather than `supabase.from(...)` — that naming choice is deliberate and load-bearing, not arbitrary.

### Structured caps rework
The original product notes described position/sector/sleeve caps as free text (e.g. "Single-Stock Cap: 8-10%"), which meant the compliance engine (planned for later) would have had nothing machine-readable to check against, and the numbers could drift between the displayed note text and any downstream logic. Reworked into fully numeric fields: `sleeveMinPct`/`sleeveMaxPct` (sleeve/portfolio equity exposure range), `positionMinPct`/`positionMaxPct` (true min-max per-holding size range — a stock must clear the minimum to be worth including, and not exceed the maximum), `positionBasis` (whether position sizing is "of portfolio" or "of sleeve"), and `sectorCapMaxPct` (single flat sector cap, deliberately with no per-sector overrides — an earlier BFSI-specific carve-out was removed as not making sense for a general rule). A single function, `formatCapsSentence()`, generates the human-readable caps sentence for the note display and all three export formats from these same numbers — eliminating any possibility of the displayed text and the underlying numbers drifting apart. Existing product data was migrated into the new fields by hand, reading only numbers already stated in each product's original text — nothing was invented, and fields were left blank where no explicit number existed in the source.

### PDF export
Added full-note PDF export (`exportPdf`, mirrors the Word export's structure) and a separate short-form client-summary PDF (`exportClientSummaryPdf` — a fixed field set: objective, risk profile, benchmark, minimum investment, suitability, top 5 key risks, genuinely 1-2 pages) using jsPDF + jsPDF-autotable, with a light print-appropriate theme derived from the app's dark web palette. Requested because the team needed something easy to share with prospective clients for feedback without recreating formatting by hand each time.

### Create/Templates redesign
The original "Create New Product" flow only let you clone one of the 9 real products, framed misleadingly as "templates" — conflating live client-facing content with reusable scaffolding, and forcing every new product to start from an existing one even when nothing matched. Redesigned into three explicit, separate paths: Start Blank, From Archetype Template, From Existing Product. Added a new `templates` Supabase table, deliberately separate from `products` (not a flag on product rows) so the normal product edit/archive/delete code paths can never accidentally touch a template. Seeded four starter archetypes (Single-Sleeve Equity, Strategic Allocation, Risk-Profiled Variants, Goal-Based) matching the four real structural shapes already in use. Added a full "Manage Templates" screen with create/edit/delete, kept entirely separate from the product editor.

### Phase 1 — Compliance Engine
Added: `products.regulatory_regime` column (drives which compliance checks apply — not every product is subject to SEBI rules, since Vriksha may run the same strategy for non-India clients under a different regime), `portfolio_holdings` table (current/live constituent list per product, separate from the note's allocation *ranges*), `portfolio_holdings_history` table (append-only audit log, one row per "Check Compliance" run). Built a regime-scoped compliance-check engine (`runComplianceCheck()`) that reads real cap thresholds directly from each product's note fields (never hardcoded), runs single-stock cap, sector cap, and weights-sum-to-100% checks for `india_sebi`-regime products, and just the universal weights check for other regimes. Added a "Compliance" screen (overview + per-product detail with holdings CRUD and check history) and Publish gating: if the last recorded check is Non-Compliant, Publish shows an override-confirm dialog rather than silently proceeding or hard-blocking with no escape hatch.

**Deliberately deferred in Phase 1**: maker-checker (two-person approval before a compliance-flagged action can proceed). This would require a roles/permissions system that doesn't exist anywhere else in the app (today: any authenticated user can edit anything), and standing that up for one workflow was judged not worth the complexity right now. If the team grows enough that single-approver compliance stops being acceptable, this will need real rework, not just an add-on.

### Pre-freeze security and robustness fixes
Before freezing the app, an independent audit (two separate verification passes) found three real issues worth fixing given the app would sit unmonitored for an extended period during the rebuild:
1. **Stored XSS via product name/code/etc.**: user-entered product names, codes, and related fields rendered unescaped into `innerHTML` in ~10 places (nav list, overview cards, compliance screens, archive cards, headers). Fixed by wrapping all of them in the existing `escText()`/`escAttr()` helpers.
2. **XSS via CSV upload preview**: uploaded CSV cell values rendered unescaped in the constituent-upload preview table. Same fix applied.
3. **Crash risk from unvalidated template JSON**: the Manage Templates screen only checked that pasted JSON was syntactically valid, not that it had the required shape. A template missing `category` or `assetClasses` could crash the app's navigation rendering for every signed-in user as soon as a product was created from it. Fixed with a minimal shape guard on save (requires `category`, `assetClasses`, `code`, `name` to be present and correctly typed).

All three fixes were verified twice: once by an independent code-reading subagent immediately after writing them, and again with a full-file structural re-read before commit.

## 3. Key decisions and why

- **Single Supabase project, not separate apps for notes vs. portfolio ops.** Considered and rejected splitting into a separate "portfolio ops" app. The actual bloat risk (unbounded time-series growth from future price/NAV data) is solved by table design and retention discipline, not by splitting the frontend — and two apps would mean two logins, two codebases, and two places for boot-sequence bugs to independently occur. See `ARCHITECTURE.md` §3 for the full reasoning.
- **No maker-checker in Phase 1.** See above — deferred specifically to avoid a roles system for one workflow.
- **Compliance checks are regime-scoped, not universal.** A single global rule set was rejected because it would incorrectly flag non-India products as "non-compliant" against SEBI-specific rules they were never subject to.
- **Compliance thresholds are read from each product's own note fields, not hardcoded or duplicated into a separate rules table.** If a cap changes, there is exactly one place to change it, and the compliance engine automatically reflects the update.
- **Templates live in a separate table from products, not a flag on products.** Direct fix for an earlier design smell (the 9 real products were themselves being used as templates), and protects templates from any accidental edit via the normal product-editing code paths.
- **Publish gating is a soft block (override-confirm), not a hard block.** Chosen deliberately over a hard block with no escape hatch, given there's no maker-checker or reason-logging system yet — a hard block with truly no way through risks locking the workflow entirely if the compliance UI has any gap.

## 4. Known limitations (carried into the freeze)

- No real-time collaborative editing — last write wins. Use Refresh before editing.
- No role-based permissions — every logged-in user can edit everything.
- No public signup or in-app password reset — both handled manually via the Supabase dashboard.
- Single-file architecture (~180KB of inline JS, no build step, no modules, no automated tests) — flagged in `ARCHITECTURE.md` §5 as the primary motivation for the rebuild (see below). Every change this large a file goes through has to be manually verified rather than caught by tooling.
- Tax treatment (`taxNote`) is a placeholder field per product ("to be detailed in a future revision") — explicitly out of scope until Phase 3.
- Risk-profile-to-allocation consistency (e.g. "a Conservative variant shouldn't show >30% equity-like exposure") is flagged by the compliance engine as a manual-confirm item, not mechanically checked yet.

## 5. Data and infrastructure reference

- **Supabase project**: "Vriksha Product Notes", ref `djrzjwhqzenykzfuzfhj`, region `ap-south-1` (Mumbai). URL: `https://djrzjwhqzenykzfuzfhj.supabase.co`.
- **Tables (as of the freeze)**: `products` (10 rows — 9 real products + 1 test product created during Phase 1 verification, worth deleting or relabeling), `product_versions` (append-only publish history), `templates` (4 seeded archetypes), `portfolio_holdings` (0 rows — no holdings entered yet as of the freeze), `portfolio_holdings_history` (0 rows — no compliance checks run yet as of the freeze).
- **Repo**: `github.com/prathmeshgupta/vriksha_product_notes`, mirrored locally at this OneDrive-synced folder.
- **Deployment**: GitHub Pages, serving from `main` branch root.
- **Rollback safety net**: git tag `pre-phase1-stable` and branch `stable`, both pinned to commit `011141d` — the last commit before the Phase 1 Compliance Engine and pre-freeze fixes were added. If anything about the frozen state needs to be undone, this is the fallback point.

## 6. The freeze and rebuild decision (2026-07-16)

After Phase 1 shipped, the user raised a structural concern: the app had grown to ~180KB of inline JavaScript in one file with no build step, no modules, and no automated tests, and every edit this session required manual, defensive verification (grep-auditing call sites by hand, independent subagent re-reads) to catch bugs that a compiler or test suite would normally catch automatically. With four more major phases planned (client-facing reporting, tax module, a significantly larger constituent-management UI, and live pricing/performance tracking with a scheduled backend job), the risk of a silent regression per change was judged likely to keep climbing rather than plateau.

Decision: freeze this app's feature set (after closing out the three pre-freeze security/robustness issues above), keep it running as the live, in-use system, and start a ground-up rebuild in a new, modular architecture — including re-implementing Phase 1 there, not just continuing from Phase 2 onward. The rebuild happens on a separate branch (`rebuild`) in this same repo rather than a new repo, so history and tooling stay unified while the two versions coexist; a separate repo may still make sense once the rebuild is close to replacing this app, but that's a later decision, not a now decision.

A tagged commit (`pre-phase1-stable`) and a `stable` branch were created as an explicit rollback point before any of this, in case something about the frozen state needs to be undone.

See `ROADMAP.md` for the rebuild's planned phases and `ARCHITECTURE.md` §5 for the original single-file-architecture concern that prompted this decision.
