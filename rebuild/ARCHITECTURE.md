# Vriksha Product Note Studio — Rebuild Architecture

Last updated: 2026-07-20 (through R3). Technical structure for the rebuild. See `STRATEGY.md` for why, `ROADMAP.md` for build order. R0-R3 are built and pushed; §3 below now describes the actual structure, not just the original plan — see that section for the two places it drifted from the R0 proposal.

## 1. Stack

- **Vite** (build tool, dev server) + **React 19** + **TypeScript** (strict mode) — scaffolded via `npm create vite@latest -- --template react-ts`.
- **Supabase** — same project as the frozen app (`djrzjwhqzenykzfuzfhj`, "Vriksha Product Notes", `ap-south-1`), via `@supabase/supabase-js`.
- **Deployment**: GitHub Pages, served from this repo. **Resolved 2026-07-16** (previously flagged as a Blocking open item — see below for why it isn't one): GitHub Pages only serves one branch/folder per repository at a time, configured in Settings → Pages, and switching that setting is a fast (~1 minute), fully reversible dropdown change — it does not rebuild or touch git history, it just changes which existing branch's content Pages happens to serve. This means there is no real risk during R0-R7: the rebuild only ever gets pushed to the `rebuild` branch (never `main`), Pages configuration stays pointed at `main` throughout development, and nothing about local development, `npm run dev`, or pushing commits to `rebuild` can affect what's live. Preview during R0-R7 is **local only** (`npm run dev`, viewed at `localhost` on the developer's machine) — no second repo, no GitHub Action, no separate Pages target needed. At R8 (cutover), once the rebuild is verified and approved, going live is simply switching the Settings → Pages source from `main` to `rebuild` (or merging `rebuild` into `main` first, then no setting change is needed at all — exact mechanics to be confirmed at R8, but both are low-risk, low-effort options, not open engineering problems).
- **Document export libraries** (unchanged from frozen app, no reason to switch): `docx` (Word), `xlsx`/SheetJS (Excel), `jspdf` + `jspdf-autotable` (PDF), `papaparse` (CSV upload), `file-saver` (browser download triggering).

## 2. Design tokens (pulled directly from the frozen app's live CSS — `index.html` `:root` block, verified 2026-07-16)

```css
:root {
  --forest:      #0f1a12;
  --deep:        #0a1209;
  --canopy:      #1a2e1d;
  --moss:        #2d4a32;
  --sage:        #7a9e7e;
  --pale:        #c8d9c9;
  --mist:        #e8f0e9;
  --gold:        #c4a84f;
  --gold-dim:    rgba(196,168,79,0.35);
  --text:        #dde8de;
  --text-dim:    rgba(221,232,222,0.55);
  --text-faint:  rgba(221,232,222,0.25);
  --red:         #d97a6c;
  --amber:       #d4b06a;
  --green:       #8fb894;
  --radius: 3px;
}
```

**Typography** — three Google Fonts, loaded exactly as in the frozen app:
```
https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Lora:ital,wght@0,500;1,400;1,500&family=JetBrains+Mono:wght@300;400;500&display=swap
```
- **Syne** (sans-serif, bold/700) — headings, h1-h3, card titles, brand/logo text.
- **Lora** (serif) — body text, base `font-size:15px; line-height:1.7`.
- **JetBrains Mono** (monospace) — UI chrome: buttons, labels, status pills, callouts, form field labels. This mono-for-UI-chrome / serif-for-content split is a deliberate, distinctive part of the Vriksha visual identity — preserve it exactly, it is not incidental.

**Core component visual reference** (exact values from the frozen app, to match when building `Button`, `Card`, `StatusPill`, `Callout` in R1):
- `.btn`: transparent background, 1px solid `var(--moss)` border, `var(--text-dim)` color, JetBrains Mono `.7rem` uppercase with `.06em` letter-spacing, `var(--radius)` corners.
- `.btn.primary`: `var(--gold)` background, `var(--deep)` text.
- `.status-pill.published`: `var(--green)` text on `rgba(143,184,148,.14)` background. `.status-pill.draft`: `var(--amber)` text on `rgba(212,176,106,.14)` background. (Reused for Compliant/Non-Compliant in the Compliance screens — same two-color system, not a third color.)
- `.callout`: `var(--deep)` background, 3px `var(--gold)` left border, JetBrains Mono `.72rem`, `var(--sage)` text. `.warn` variant swaps the border/text to `var(--amber)`, `.danger` to `var(--red)`.
- `.p-card`: `var(--canopy)` background, 1px `var(--moss)` border, a 2px gold left-edge that animates in on hover.

## 3. Folder structure (actual, as of R3 — updated 2026-07-20; original R0 proposal below diverged in two places, noted inline)

```
src/
  main.tsx                 — entry point
  App.tsx                  — top-level routing/shell (gates on auth, then renders AppShell)
  design-system/           — R1: the component library
    tokens.css              — the :root variables above, verbatim, plus the global box-sizing reset (added R3)
    Button.tsx / Card.tsx / StatusPill.tsx / Callout.tsx / Pill.tsx
    DevComponentsPage.tsx     — R1's visual QA page
    form/
      TextField.tsx / NumberField.tsx / SelectField.tsx / TextAreaField.tsx / FieldRow.tsx
      fields.css
    index.ts                 — barrel export
  data/                     — R2: Supabase access layer
    supabaseClient.ts
    types.ts                  — interfaces for every table; the product note `data` jsonb is a discriminated union (ProductNoteData), narrowed via lib/archetype.ts's type guards rather than a literal tag field, matching the frozen app
    products.ts                — getProduct, listProducts, listVersionCounts, listProductVersions, persistProduct, publishProduct, unpublishToDraft, archiveProduct, unarchiveProduct
    templates.ts                — CRUD for templates, including the shape-validation guard
    holdings.ts                  — CRUD for portfolio_holdings + read access to portfolio_holdings_history (R6 will build the compliance logic on top of this, not re-build the data access)
  lib/                      — pure helper functions. **Deviation from the R0 proposal's `utils/`**: `utils/` exists as an empty placeholder folder, everything actually landed in `lib/` instead. Rename/remove `utils/` if it stays unused past R4-R6.
    archetype.ts               — isSingleSleeve/isStrategicAllocation/isRiskVariant/isGoalBased type guards
    capsFormat.ts               — clampPct, formatCapsSentence, formatMinMaxRange
    diff.ts                       — DIFF_FIELDS, word-level LCS diff for version history
    weightSum.ts                   — sleeve/allocation weight-sum validation
  features/
    auth/                     — R2: BootScreen, LoginScreen
    products/                 — R3: view/edit/version/publish/archive + Backup & Sync + Upgrade Roadmap. **Deviation from the R0 proposal's `product-note/`**: an empty `features/product-note/.gitkeep` placeholder still exists from the original plan but was never used — everything real is under `features/products/` (plural). Safe to delete the stray empty folder; flagged, not yet actioned.
      AppShell.tsx                — sidebar nav + view routing (no router library)
      ProductOverview.tsx / ProductDetail.tsx / ProductEditor.tsx / VersionHistory.tsx / ArchiveView.tsx / BackupView.tsx / RoadmapView.tsx
      editors/                     — SleeveEditor, AllocationEditor, VariantEditor, GoalFrameworkEditor, KeyRisksEditor
      shared/                      — CapFieldsRow, WeightSumBadge (used across editors)
      products.css                 — everything the frozen app's global <style> block covers that design-system/*.css doesn't
    export/                   — R4, not started (empty placeholder)
    create/, templates/        — R5, not started (empty placeholders)
    compliance/               — R6, not started (empty placeholder)
  hooks/
    useAuth.ts                — R2
__tests__/ or *.test.ts co-located — still not started; R6 remains the planned starting point (see §6)
```

Updated from the original R0 proposal per this doc's own instruction below — two folder names drifted during implementation (`product-note/`→`products/`, `utils/`→`lib/`) and are called out above rather than silently left inconsistent with the code.

## 4. Data model — no changes from the frozen app

The rebuild reads/writes the exact same Supabase tables the frozen app uses. Full schema reference: frozen app's `ARCHITECTURE.md` §2 (repo root). Summary for quick reference:

- `products` — one row per product note, `data` jsonb holds the full editable note, `regulatory_regime` column drives compliance scoping.
- `product_versions` — append-only publish snapshots.
- `templates` — archetype starting structures, separate table from `products` by design.
- `portfolio_holdings` — current/live constituent list per product.
- `portfolio_holdings_history` — append-only compliance-check audit log.

RLS is unchanged: any authenticated user, full read/write, no per-user permission model. If this changes, it changes at the Supabase level and both the frozen app and rebuild would need to respect it identically — not a rebuild-specific decision.

## 5. TypeScript strategy

Strict mode on from R0, plus `noUncheckedIndexedAccess` (a stricter-than-default choice that types every array index access as possibly `undefined` — real implications documented in `ROADMAP.md`'s R3 section, where it caught 27 real errors on the first actual compiler run). Every Supabase table has a corresponding interface in `data/types.ts`, cross-checked against live schema/data, not assumed.

**Decided in R2/R3, not just proposed**: the product note's `data` jsonb is `ProductNoteData`, a discriminated union of `SingleSleeveNote | StrategicAllocationNote | RiskVariantNote | GoalBasedNote`, narrowed by presence of an optional field (`styleSleeves`/`strategicAllocationRanges`/`variants`/`goalFramework`) rather than a literal tag — matching the frozen app's own `if(p.styleSleeves)`-style branching. Narrowing happens through type guards in `lib/archetype.ts`, not inline `in` checks scattered across components. One real pitfall hit while wiring this up, worth remembering for any future "patch this union generically" helper: `Partial<UnionType>` does not mean "any subset of fields from any member" — `keyof` on a union only includes fields common to *every* member, so a naive patch helper silently rejects valid archetype-specific patches as compile errors. Fixed with an intersection of each member's own `Partial<...>` (see `ProductEditor.tsx`'s `NotePatch` type).

## 6. Testing strategy

No tests exist yet (R0-R5 are primarily re-implementation, verified manually against the frozen app per `ROADMAP.md`'s phase-by-phase verification steps). Real automated tests start in R6 with the compliance engine — `runComplianceCheck()` and `getEffectiveCapThresholds()` are close to pure functions (given inputs, produce a deterministic result) and are exactly the logic most likely to have a subtle regression matter. Test framework choice (Vitest, being Vite-native, is the likely default) to be confirmed in R0 setup.

## 7. Environment / secrets

Supabase publishable key: same pattern as the frozen app (safe to expose client-side, RLS is the real boundary) — but managed via Vite env vars (`import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) rather than hardcoded in source, which is a real improvement over the frozen app's approach and worth calling out as intentional, not accidental drift.
