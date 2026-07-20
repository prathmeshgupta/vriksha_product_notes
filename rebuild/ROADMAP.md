# Vriksha Product Note Studio — Rebuild Roadmap

Last updated: 2026-07-16. This is the phase-by-phase build order for the rebuild itself. See `STRATEGY.md` in this folder for why this rebuild exists and what does/doesn't change. See `ARCHITECTURE.md` in this folder for technical structure. The frozen app's own `ROADMAP.md` (repo root) still describes the original Phase 1-6 feature roadmap — this document is about rebuilding that same feature set (and eventually those same phases) on the new stack, not a replacement feature list.

Update the status column as work ships.

| # | Rebuild Phase | Status |
|---|---|---|
| R0 | Project scaffold (Vite + React + TS, base tooling) | ✅ Done (commit `216c8e8` on `rebuild`, 2026-07-16; index.html collision found and fixed same day, see below) |
| R1 | Design tokens + component library | ✅ Done (commit `1403dae` on `rebuild`, 2026-07-16) |
| R2 | Data layer (Supabase client, TypeScript types, auth) | ✅ Done (commit `5068b13` on `rebuild`, 2026-07-20; verified locally — login, real Supabase data load, sign-out, build, lint all clean) |
| R3 | Re-implement: product note viewing, editing, versioning/publish | Code complete, pending your local verification and commit (see R3 section below) |
| R4 | Re-implement: exports (Word/Excel/PDF), CSV upload | Not started |
| R5 | Re-implement: Create flow (blank/template/existing), Manage Templates | Not started |
| R6 | Re-implement: Phase 1 Compliance Engine | Not started |
| R7 | Parity verification against frozen app | Not started |
| R8 | Cutover decision | Not started |

After R8, the rebuild continues with the *original* Phase 2-6 roadmap (client-facing reporting, tax module, constituent UI, live pricing, smallcase) — those are genuinely new features, not re-implementation, and get their own detailed phase docs when each one starts, the same way Phase 1 did for the frozen app.

---

## R0 — Project scaffold

**Status**: a default `npm create vite@latest -- --template react-ts` scaffold exists at this point, unmodified, not yet installed or customized. Nothing else has been built.

**Scope**: install dependencies, verify the default scaffold runs (`npm run dev`), add TypeScript strict mode, add a linter/formatter (the scaffold includes `oxlint` by default — decide whether to keep it or switch to ESLint+Prettier), set up the folder structure defined in `ARCHITECTURE.md`, configure Vite for GitHub Pages deployment (base path, build output location), add the Supabase client library and environment variable handling for the publishable key.

**Explicitly not in scope for R0**: any actual product UI, any Supabase queries, any design tokens beyond placeholder values.

**Deployment mechanism — resolved 2026-07-16** (previously an open Blocking item in an earlier draft of this doc): GitHub Pages only serves whatever branch is set in Settings → Pages, and switching it is a fast, reversible dropdown change — not a rebuild, not a git operation, no risk to `main`. Preview during R0-R7 is local-only (`npm run dev`); the rebuild only ever pushes to the `rebuild` branch; Pages configuration stays on `main` untouched until R8 cutover is explicitly approved. See `ARCHITECTURE.md` §1.

**Decisions — resolved 2026-07-16**:
1. **Linter: ESLint (flat config) + `typescript-eslint`**, not the scaffold's default `oxlint`. Reason was not preference but a hard compatibility issue: `oxlint` and Vite 8's default toolchain both ship native Rust binaries (`@oxlint/binding-*`, `@rolldown/binding-*`, `lightningcss-*`), and in the sandbox environment used to build this scaffold, running either crashed immediately with a SIGBUS ("Bus error (core dumped)", exit 135) — confirmed reproducible even via `--version`, and confirmed not an architecture mismatch (host is x86_64, binaries were x86_64). Vite itself was pinned back to `^5.4.11` (the last pre-Rust-rewrite line) paired with `@vitejs/plugin-react@^4.3.4` to route around the same class of crash, and `oxlint` was dropped for the same reason rather than leaving one native-binary risk in place after removing the other. ESLint is pure JS, has no native-binary crash risk, and is the more mature/battle-tested option regardless.
2. **Test framework: Vitest**, confirmed (Vite-native, no separate config needed, works with the pinned Vite 5.4 line).

**Definition of Done for R0**: scaffold installs and runs locally (`npm run dev`) ✅, TypeScript strict mode on with zero errors ✅, both tooling decisions above confirmed and recorded ✅, folder structure from `ARCHITECTURE.md` §3 — pending, folder structure from `ARCHITECTURE.md` §3 exists (even if mostly empty), Supabase client connects successfully to the real project (a trivial "fetch and log one row" smoke test, not real data-layer code — that's R2).

**Known sandbox-environment gotcha, documented for any future session continuing this build**: this development sandbox has at least two independent flakiness sources unrelated to the code itself, both worked around during R0 and worth knowing about before assuming a similar failure is a real bug: (a) a class of newer Rust-native Node addons (Vite 8's `@rolldown`/`@oxc-project` binaries, `oxlint`, `lightningcss`) reliably SIGBUS-crash in this specific sandbox even though the binaries are architecture-correct — avoided by pinning Vite to the `5.4.x` line and using ESLint instead of oxlint; (b) file writes to the sandbox's `outputs` mount have intermittently landed truncated or null-byte-padded even when the write tool reported success (seen on `tsconfig.app.json`, `tsconfig.node.json`, `package.json` during R0) — always verify a freshly-written config file's exact byte content (e.g. `python3 -c "open(f,'rb').read()"`) before trusting a parser's error message about it, since a "syntax error" a few bytes from EOF is more likely mount corruption than an actual mistake in what was written.

**Incident, 2026-07-16 — frozen app's `index.html` overwritten by the R0 scaffold copy, found and fixed same day (see `R0_INDEX_HTML_FIX.md` in this folder for the full account)**: the scaffold's default Vite entry file and the frozen app's single-file app both happened to be named `index.html`. Moving the scaffold into the repo root via `robocopy ... /E` silently overwrote the real ~200KB frozen app with Vite's 370-byte stub, and this got committed and pushed to `rebuild` before it was noticed (during the start of R1, when grepping the "frozen" `index.html` for exact CSS values returned nothing). No data was lost — `main` was never touched, `stable`/`pre-phase1-stable` were unaffected, and all product data lives in Supabase, not this file — but it was a real, avoidable mistake in the R0 instructions. Root cause and fix: renamed the rebuild's Vite entry point to `app.html` (`vite.config.ts` now sets `build.rollupOptions.input: 'app.html'` and `server.open: '/app.html'`) specifically so the two apps can never again share a filename at the repo root.

**Guardrail added as a result — apply this to every future phase, not just R0**: before any bulk file copy between the sandbox/scaffold and the repo root (`robocopy`, `cp -r`, `xcopy`, or equivalent), first diff the *filenames* of what's being copied against what already exists at the destination (e.g. `Compare-Object (dir source -Name) (dir dest -Name)` in PowerShell, or just `dir` both and eyeball it for anything besides genuinely new files/folders). If any filename collides with something that isn't supposed to be touched, stop and rename or exclude it before copying — don't rely on memory or assumption that "the scaffold only has new files." This applies most obviously to `index.html` (now resolved by the rename) but the same check should happen again at R8 cutover time, when `rebuild`'s contents may eventually need to merge into `main` for real — that merge needs the same collision check, deliberately, not via a blind bulk copy.

**Third sandbox gotcha, found during R2 (2026-07-16/17): a from-scratch `npm install` cannot reliably complete in this sandbox.** Every sandbox shell call is hard-capped at 45 seconds and appears to run in its own torn-down process namespace, so a full dependency install (~200+ packages, no warm cache) that runs past that window doesn't pause and resume on the next call — it gets killed mid-write. This showed up as `ESLint` hanging indefinitely (`timeout 124`) on every file, including ones that had linted cleanly minutes earlier; the actual cause, confirmed by importing each dependency individually, was that `@typescript-eslint/eslint-plugin` and `@typescript-eslint/scope-manager` were silently absent from `node_modules` despite `npm ls`/the install log both reporting success (npm's own cleanup step had thrown `EPERM` on stale `esbuild` platform binaries mid-install and left the tree partially populated). A second from-scratch install attempt in a clean directory reproduced the same kill-mid-install pattern, once even leaving `node_modules/ajv` mid-rename (`ENOTEMPTY` on the next attempt). None of this reflects on the actual source files — `tsc -b --force` passed cleanly throughout, on the exact same file set, in the same sandbox. **Takeaway for future sessions**: if `npm install` in this sandbox needs to pull most/all packages fresh (no populated `node_modules` to reuse), do not trust the sandbox's own `eslint`/`vitest`/build output as authoritative — verify TypeScript correctness via `tsc -b --force` (fast, reliably completes) and a manual review against the exact rules in `eslint.config.js`, then treat the user's local machine as the source of truth for `npm run lint`/`npm run build`, since it has a real, already-populated `node_modules` and isn't subject to this per-call timeout.

---

## R1 — Design tokens + component library

**Goal**: encode the Vriksha design palette (forest greens, gold accent, Lora/JetBrains Mono typography, existing card/button/status-pill/callout visual language) as reusable, typed React components, before building any real screens on top of them.

**Why first**: per `STRATEGY.md`, the design system's reuse value is the main reason a framework was chosen over vanilla JS. Building it first means every subsequent screen composes it rather than a screen being built ad-hoc and the design system retrofitted after.

**Scope**: CSS custom properties / design tokens file matching the frozen app's `:root` variables exactly (colors, radius, etc.) — see `ARCHITECTURE.md` §2 for the exact token values pulled from the live app. Core components: `Button` (with primary/danger/small variants), `Card`, `StatusPill` (published/draft/compliant/non-compliant variants), `Callout` (with warn/danger variants), `Pill`, form field primitives (text input, number input with min/max, select, textarea) matching the frozen app's `.field-row`/`.field-label` pattern. A small Storybook-style demo page (or just a `/dev/components` route) to visually verify each component against the frozen app's live screenshots before moving on.

**Verification before moving to R2**: side-by-side visual comparison against the frozen app for every component built — not just "does it compile," but "does it look identical."

---

## R2 — Data layer

**Goal**: typed, tested access to the same Supabase project the frozen app uses — no new tables yet, just correctly reading/writing the existing schema.

**Scope**: Supabase client setup (same project, same publishable key pattern as the frozen app). TypeScript interfaces for every table currently in the schema: `products`, `product_versions`, `templates`, `portfolio_holdings`, `portfolio_holdings_history` — field-for-field matching what's documented in the frozen app's `ARCHITECTURE.md` §2. Auth flow (login screen, session handling) re-implemented — this is the second place (after the original `supabase`/`sb` naming collision bug) where a subtle bug could silently break the whole app, so extra care and explicit testing here. A typed data-access layer (functions like `getProduct(id)`, `listProducts()`, `publishProduct(id, note)`) that the UI calls, rather than raw Supabase calls scattered through components — this is one of the concrete structural improvements TypeScript+modules is supposed to deliver over the frozen app's approach.

**Verification before moving to R3**: can log in, can read the real 9+ products from the real database, types compile with no `any` escape hatches on the core data shapes. This is flagged elsewhere in this doc as a place a subtle bug could silently break the whole app (same class of risk as the frozen app's original `supabase`/`sb` naming collision) — so verification explicitly includes session-expiry and token-refresh behavior (log in, wait past a token's normal lifetime or force-expire it, confirm the app degrades to a clear re-login prompt rather than silently failing every subsequent request) and logout, not just "can log in once."

---

## R3 — Product note viewing, editing, versioning/publish

**Goal**: re-implement the core workflow — view a product note, edit every field type the frozen app supports (freeform text, numeric cap ranges, sleeve/variant/allocation arrays), publish a version, view history/diff.

**Scope**: this is the single biggest re-implementation phase, since it's most of what the frozen app's `index.html` actually does. Needs care in re-reading exactly how the frozen app's editor handles each of the 4 product "shapes" (single-sleeve, strategic-allocation, risk-variant, goal-based) — see the frozen app's `PROJECT_HISTORY.md` §2 (structured caps rework) for the exact field semantics (`sleeveMinPct`/`sleeveMaxPct`/`positionMinPct`/`positionMaxPct`/`positionBasis`/`sectorCapMaxPct`) before building the corresponding editor components.

**Scope also includes archive/unarchive** — not a separate phase, folded into R3 since it operates on the same product record and status field as the rest of this phase's work.

**Verification before moving to R4**: can edit and publish a real product note in the new app and see the resulting `product_versions` row match what the frozen app would have produced for the same edit; can archive and unarchive a product and see it correctly move between the active/archived views.

**Status**: code complete (commit pending your local verification below), built 2026-07-20. Sidebar nav (grouped by category, search, archived link, collapse toggle), overview grid, read-only note view (all 4 archetypes), full editor (Key Facts, Objective/Philosophy, Construction Rules + caps, style sleeves / strategic allocation / risk variants / goal framework depending on archetype, key risks), publish flow (note prompt, no compliance gate yet -- that's R6), version history + word-level diff, archive/unarchive. Export/Email buttons intentionally omitted (R4), Compliance button intentionally omitted (R6) -- not stubbed, per `STRATEGY.md`'s "no half-built UI" preference.

**R2's `data/types.ts` had 3 real gaps, found and fixed while building R3's editor against it** (a good example of why "verify against the frozen app's actual behavior, not the sampled data" matters -- R2's types were derived from `information_schema`/sample-row inspection, which missed fields that were simply null/absent in every sampled row):
1. `CapRange` only had `sleeveMinPct`/`sleeveMaxPct` -- missing `positionMinPct`/`positionMaxPct`/`positionBasis`, which the frozen app's `capFieldsHtml()` proves are real, live-edited fields on every sleeve/allocation row, not just the top-level construction rules.
2. `PortfolioConstructionRules` was missing `sleeveMinPct`/`sleeveMaxPct`/`positionMinPct` entirely (had `positionMaxPct` only).
3. `ProductNoteCommon` was missing `selectionMethodology`/`portfolioConstruction` (freeform prose fields checked generically in the frozen app's editor/read view/`DIFF_FIELDS`, not scoped to one archetype); `RiskVariant` was missing `factorMix`/`universe`/`stockCount`/`referenceIndex`/`rationale` (a second optional field set for systematic/factor-based variants).

**A real TypeScript pitfall hit and fixed while wiring the editor**: `Partial<ProductNoteData>` does not mean "any subset of fields from any archetype" -- `keyof` on a union type only includes fields common to *every* member, so a naive `patch(fields: Partial<ProductNoteData>)` helper would have rejected `{ styleSleeves }`, `{ variants }`, etc. outright as a compile error. Fixed in `ProductEditor.tsx` with an explicit intersection of each archetype's own `Partial<...>`, which correctly gives the union of all fields, each optional. Worth remembering for R4/R5/R6 if similar "patch the note generically" helpers come up again.

**Sandbox note**: directory operations (even a plain `du -sh` on `node_modules`) started timing out against this sandbox's 45-second-per-call limit partway through R3, on top of the from-scratch-`npm install` limitation already documented above. Verification for R3 fell back to `tsc`-free manual line-by-line review against the exact types/imports (same fallback as R2's ESLint gotcha) rather than a sandbox-side compiler run. Your local `npm run dev`/build/lint below is the first real compiler pass this code gets.

**Round 2: fixes from your first local build + manual test pass (2026-07-20)**. Your `npm run build` surfaced 27 real `tsc` errors that manual review missed, and using the app surfaced 6 more issues. All fixed in the same commit as the rest of R3, not deferred:

1. **27 `noUncheckedIndexedAccess` compile errors** (`lib/diff.ts`, `lib/weightSum.ts`, `VersionHistory.tsx`) -- confirms the sandbox-verification gap above was real, not theoretical: manual review without a compiler systematically misses tsconfig-flag-driven strictness issues. Fixed with explicit guards / a narrowly-scoped `at<T>()` helper, not by loosening the tsconfig flag.
2. **Critical: debounced-save data loss.** The original `useEffect(() => {...}, [data])` cleanup only called `clearTimeout` on the pending save, never flushed it -- so navigating away within the 800ms debounce window silently discarded the edit instead of persisting it. This is very likely why an edit to P1's GARP sleeve appeared "reverted" after navigating back to it. Fixed by splitting scheduling (per-keystroke, cancels + reschedules) from an unmount-only effect that flushes rather than cancels any pending save.
3. **Missing global `box-sizing: border-box` reset** -- R1 never ported the frozen app's very first CSS rule. Without it, `width:100%` inputs render wider than their grid cells and the 30px `.row-remove` button overflows its 34px track under the browser's default content-box model. This was the single root cause of two separately-reported symptoms (Key Facts card's inconsistent right margin; the misplaced × button next to sleeve rows). Fixed in `tokens.css`.
4. **Collapsible sidebar sections.** "Discretionary"/"Systematic"/"Archived" headings are now clickable, with a −/+ indicator, matching the requested behavior.
5. **`stockCountRange`/`cashBuffer` converted from free text to structured numeric min/max fields** -- the Construction Rules section is explicitly labeled "structured, numeric only" but these two were still plain text inputs, a real inconsistency with the rest of the section, not a style choice. `PortfolioConstructionRules` now has `stockCountMin`/`stockCountMax`/`cashBufferMinPct`/`cashBufferMaxPct` instead. The one live product (P1/DSOP) with real values ("15-25", "0-5%") was migrated via a one-off SQL `UPDATE`, not silently dropped -- verified the parsed numbers match the original text before and after.
6. **Sidebar audit + two missing pages built.** You asked whether the sidebar was missing items on purpose. Checked every nav item in the frozen app's source against all 3 planning docs: `+ New Product`, `Manage Templates`, `Compliance`, `CSV Constituent Upload` are genuinely deferred (R5/R6/R4, intentionally not stubbed per `STRATEGY.md`'s "no half-built UI" rule). But `Backup & Sync` and `Upgrade Roadmap` were not mentioned in any planning doc at all -- a real gap, not a deferral. Per your direction, built both now rather than leaving the gap: `RoadmapView.tsx` (static, ported from the frozen app's `renderRoadmap()`, with its stale "Backend + database" item marked done since that's already true) and `BackupView.tsx` (status readout + full JSON snapshot download covering every product's data, versions, holdings, and holdings-check history, plus templates -- more complete than the frozen app's own export needed to be, since R2's data layer already has typed access to holdings/templates even though R6 hasn't built the Compliance UI on top of them yet). Also fixed "Archived Products" to always appear in the sidebar (it was conditionally hidden when 0 products were archived; the frozen app always shows it).
7. **CSS bugs**: `.input-sm`'s `width: 90px` and the global `input[type='number']{width:100%}` rule have equal CSS specificity, so whichever stylesheet happened to load later in the bundle silently won -- this is why Stock Count Range/Cash Buffer rendered as two full-width boxes instead of a compact pair. Fixed with `!important` on `.input-sm` (its whole purpose is overriding that default, so this is correct here, not a code smell) and removed now-redundant inline `width` styles in `CapFieldsRow.tsx`. Also added visible spacing between each cap-field's label and its input (`.cap-fields-row label` was a plain inline element with no gap), and widened the Basis dropdown from 90px to 130px so "% of portfolio" doesn't get clipped.
8. **Redundant free-text weight-range fields removed.** `StyleSleeve.weightRange` and `AllocationRange.range` duplicated `sleeveMinPct`/`sleeveMaxPct` with no sync between the two -- flagged by you as serving no purpose next to the numeric fields. Removed from both types (the identical pattern in `AllocationEditor.tsx`, used by strategic-allocation and every risk-variant's allocation table, was fixed the same way even though only the sleeve editor was explicitly named -- same redundancy, same fix). `WeightSumBadge`/`lib/weightSum.ts` now sum the numeric fields directly instead of regex-parsing text. All 9 live products' `styleSleeves`/`strategicAllocationRanges`/`variants[*].allocation` had matching min/max values already present, so this was pure dead-field removal, verified row-by-row before dropping the columns, not a lossy migration. **Not migrated**: the 2 existing `product_versions` rows for P1, which are immutable historical audit-trail snapshots (v1 even predates the pre-freeze cap-fields schema entirely, carrying long-gone field names like `singleStockCap`) -- consistent with how version history already tolerates older shapes via the generic `Record<string, unknown>` diff path, not silently dropped.

---

## R4 — Exports and CSV upload

**Goal**: re-implement Word/Excel/PDF export and CSV constituent upload.

**Scope**: same underlying libraries the frozen app uses (docx.js, SheetJS/xlsx, jsPDF+autotable, PapaParse) — no reason to switch libraries, just re-implement the document-generation logic in a typed, modular way instead of one long function per format. Reuse the frozen app's `formatCapsSentence()`-equivalent single-source-of-truth pattern so the note display and every export format read from the same formatting function, not duplicated logic.

**Verification before moving to R5**: exported documents for the same product, same version, are content-equivalent to what the frozen app produces (not necessarily byte-identical, but same information, same structure).

---

## R5 — Create flow + Manage Templates

**Goal**: re-implement the three-path Create screen (blank/template/existing) and the Manage Templates CRUD screen.

**Scope**: straightforward re-implementation against the same `templates` table — no design changes needed, this was only just built in the frozen app and is considered correct as designed. **Must explicitly re-implement the template-JSON shape-validation guard** (requires `category`, `assetClasses`, `code`, `name` present and correctly typed before a template save is accepted) — this was a real, hard-won fix in the frozen app (see repo-root `PROJECT_HISTORY.md` §2, "pre-freeze security and robustness fixes") that closed a crash risk affecting every signed-in user, not a nice-to-have. Do not assume TypeScript's compile-time types cover this — the JSON is pasted as a runtime string by the user in the Manage Templates screen and must be validated at runtime (e.g. with a schema-validation library like `zod`, or the same manual field-by-field check the frozen app uses), the same class of gap TypeScript's static types don't catch on their own.

**Verification before moving to R6**: can create, edit, and delete a template; saving a template missing a required field (e.g. no `category`) is rejected with a clear error, not silently accepted; a product created from each of the 4 seeded archetype templates renders correctly with no crash.

---

## R6 — Phase 1 Compliance Engine

**Goal**: re-implement holdings CRUD, the regime-scoped compliance-check engine, the Compliance screens, and Publish gating.

**Scope**: re-implement `runComplianceCheck()`'s logic (reads cap thresholds from the product's own note fields, never hardcoded; regime-scoped so non-`india_sebi` products only run the universal weights check) as a properly tested, typed module rather than one large function. This is the best candidate in the whole rebuild for actual unit tests — the compliance logic is pure-ish (given holdings + product rules, produce a check result) and is exactly the kind of logic where a silent regression matters most.

**Verification before moving to R7**: the same holdings + product combination produces the same compliance verdict in both the frozen app and the rebuild.

---

## R7 — Parity verification

**Goal**: systematic confirmation that the rebuild does everything the frozen app does, before anyone starts relying on it day-to-day.

**Scope**: a checklist walkthrough of every feature listed in `STRATEGY.md` §2, run against both apps side by side. Any gap found gets fixed or explicitly logged as a deliberate, discussed change — not silently dropped.

**Explicitly includes re-verifying the frozen app's three pre-freeze security/robustness fixes** (repo-root `PROJECT_HISTORY.md` §2) are not lost in the rebuild: (1) product name/code/etc. rendered safely with no injection risk anywhere user-entered text is displayed, (2) CSV-upload preview table renders uploaded cell values safely, (3) template JSON shape validation (see R5). Note: React's JSX escapes interpolated values by default, which likely closes (1) and (2) "for free" compared to the frozen app's manual `escText()`/`escAttr()` calls — but this is an assumption to verify, not something to take on faith. Specifically check for any use of `dangerouslySetInnerHTML` (should be avoidable entirely in a from-scratch React build; if it appears anywhere, that's exactly where a frozen-app-style XSS gap could be reintroduced) and any place user text is interpolated into an HTML attribute like `href` or `src` rather than rendered as a JSX child (a different escaping context than JSX children default-escapes).

---

## R8 — Cutover decision

**Goal**: decide how and when the rebuild replaces the frozen app as the live system.

**Mechanically simple, per the R0 deployment resolution**: switching GitHub Pages' Settings source from `main` to `rebuild` (or merging `rebuild` into `main` first) is a fast, low-risk step whenever the team decides to go live — not an engineering problem. What's still genuinely undecided is the *policy*, not the mechanism — to discuss when this phase is reached: hard cutover (switch and be done) vs. gradual (both live for a period, frozen app kept reachable as fallback via the existing `stable` branch/tag) vs. running the rebuild only for new products while the frozen app finishes serving existing ones. This is explicitly deferred — no premature commitment to a cutover policy before R7 is complete and the rebuild has been used enough to be trusted.

"Used enough to be trusted" needs a concrete placeholder rather than being left as a vibe, so this phase has a real trigger rather than stalling indefinitely: proposed minimum bar (to be confirmed with the user when R7 is reached, not decided unilaterally here) — at least 2-4 weeks of parallel real use alongside the frozen app, zero data-loss or data-corruption incidents in that window, and R7's full parity checklist passing with no open Blocking/Important gaps.

---

## After R8 — original Phase 2-6 features

Once parity is reached and cutover has happened (or is underway), the rebuild continues with the frozen app's originally-planned Phase 2 (Client-Facing Reporting), Phase 3 (Tax Module), Phase 4 (Constituent Management UI), Phase 5 (Live Pricing & Performance), Phase 6 (smallcase Integration) — same goals as documented in the frozen app's `ROADMAP.md`, built fresh in the new architecture rather than ported. Phase 4 and Phase 5 are exactly where the framework choice is expected to pay off most (drag-and-drop rebalancing, live pricing charts) — see `STRATEGY.md` §4.
