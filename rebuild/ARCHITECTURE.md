# Vriksha Product Note Studio — Rebuild Architecture

Last updated: 2026-07-16. Technical structure for the rebuild. See `STRATEGY.md` for why, `ROADMAP.md` for build order. This document should be corrected as real decisions get made during implementation — it is a plan, not a retroactive description yet, since no real screens exist as of this writing (see R0 status in `ROADMAP.md`).

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

## 3. Folder structure (proposed for R0)

```
src/
  main.tsx                 — entry point
  App.tsx                  — top-level routing/shell
  design-system/           — R1: the component library
    tokens.css              — the :root variables above, verbatim
    Button.tsx
    Card.tsx
    StatusPill.tsx
    Callout.tsx
    Pill.tsx
    form/
      TextField.tsx
      NumberField.tsx        — the min/max/step numeric input pattern used throughout caps editing
      SelectField.tsx
      TextAreaField.tsx
    index.ts                 — barrel export
  data/                     — R2: Supabase access layer
    supabaseClient.ts         — client init, mirrors the frozen app's env-var/error-guard pattern
    types.ts                  — TypeScript interfaces for every table (Product, ProductVersion, Template, PortfolioHolding, ComplianceCheckResult, etc.)
    products.ts                — getProduct, listProducts, persistProduct, publishProduct, createBlankProduct, createProductFromTemplate, createProductFromExisting
    templates.ts                — CRUD for the templates table
    holdings.ts                  — CRUD for portfolio_holdings
    compliance.ts                  — runComplianceCheck, recordComplianceCheck, getEffectiveCapThresholds (ported from frozen app's logic, typed and unit-testable)
  features/                — R3-R6: screen-level components, one subfolder per feature area
    auth/
    product-note/             — view/edit/version/publish (R3)
    export/                     — Word/Excel/PDF/CSV (R4)
    create/                       — 3-path create flow (R5)
    templates/                     — Manage Templates screen (R5)
    compliance/                      — Compliance screens (R6)
  hooks/                    — shared React hooks (e.g. useProduct, useAuth)
  utils/                    — pure helper functions (e.g. clampPct, formatCapsSentence-equivalent)
__tests__/ or *.test.ts co-located — R6 onward, starting with compliance.ts as the highest-value test target (see ROADMAP.md R6)
```

This structure is a starting proposal, not a locked contract — expect it to be adjusted once real code exists and some of these boundaries turn out to be wrong. Update this section when that happens rather than letting the doc drift from reality (same discipline failure that happened with the frozen app's docs earlier this project — see repo-root `README.md` working agreement).

## 4. Data model — no changes from the frozen app

The rebuild reads/writes the exact same Supabase tables the frozen app uses. Full schema reference: frozen app's `ARCHITECTURE.md` §2 (repo root). Summary for quick reference:

- `products` — one row per product note, `data` jsonb holds the full editable note, `regulatory_regime` column drives compliance scoping.
- `product_versions` — append-only publish snapshots.
- `templates` — archetype starting structures, separate table from `products` by design.
- `portfolio_holdings` — current/live constituent list per product.
- `portfolio_holdings_history` — append-only compliance-check audit log.

RLS is unchanged: any authenticated user, full read/write, no per-user permission model. If this changes, it changes at the Supabase level and both the frozen app and rebuild would need to respect it identically — not a rebuild-specific decision.

## 5. TypeScript strategy

Strict mode on from R0. Every Supabase table gets a corresponding interface in `data/types.ts`, generated or hand-written to match the actual schema (cross-check against `list_tables`/`execute_sql` output, not assumption). The product note's `data` jsonb column is the trickiest type to model correctly, since it has 4 different shapes (single-sleeve / strategic-allocation / risk-variant / goal-based) sharing many common fields — likely modeled as a discriminated union or a base interface with optional archetype-specific fields, matching how the frozen app already distinguishes them (presence of `styleSleeves` vs. `strategicAllocationRanges` vs. `variants` vs. `goalFramework`). Decide the exact typing approach in R2 with real schema data in hand, not speculatively here.

## 6. Testing strategy

No tests exist yet (R0-R5 are primarily re-implementation, verified manually against the frozen app per `ROADMAP.md`'s phase-by-phase verification steps). Real automated tests start in R6 with the compliance engine — `runComplianceCheck()` and `getEffectiveCapThresholds()` are close to pure functions (given inputs, produce a deterministic result) and are exactly the logic most likely to have a subtle regression matter. Test framework choice (Vitest, being Vite-native, is the likely default) to be confirmed in R0 setup.

## 7. Environment / secrets

Supabase publishable key: same pattern as the frozen app (safe to expose client-side, RLS is the real boundary) — but managed via Vite env vars (`import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) rather than hardcoded in source, which is a real improvement over the frozen app's approach and worth calling out as intentional, not accidental drift.
