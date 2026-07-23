/**
 * TypeScript interfaces for every Supabase table the app reads/writes.
 * Field names and nullability were cross-checked directly against the live
 * schema (information_schema.columns) on 2026-07-16, not assumed from the
 * frozen app's docs alone. See rebuild/ARCHITECTURE.md §4 for the table
 * list and rebuild/ROADMAP.md R2 for how these were derived.
 *
 * No `any` anywhere in this file (per rebuild/ROADMAP.md R2 verification
 * requirement) -- fields whose exact shape wasn't fully inspected during R2
 * are typed as precisely as verified, with a comment flagging where R3
 * (which builds the real editors) should double-check/extend.
 */

// ---------- shared primitives ----------

export type RegulatoryRegime = 'india_sebi' | 'other' | 'none'
export type ProductStatus = 'draft' | 'published'

/** Matches the 4 values of templates.archetype exactly (verified via query). */
export type Archetype = 'single-sleeve' | 'strategic-allocation' | 'risk-variant' | 'goal-based'

// ---------- product note "data" jsonb shapes (one per archetype) ----------

/**
 * The reusable 5-field numeric cap block: sleeve allocation range (min/max %)
 * plus a true position-size range (min/max %) and its basis. Corrected
 * 2026-07-17 (R3) -- R2's original version only had sleeveMinPct/sleeveMaxPct,
 * because the sampled rows used to derive it happened to have positionMinPct/
 * positionMaxPct/positionBasis entirely absent rather than present-as-null.
 * The frozen app's `capFieldsHtml()` helper (repo root index.html) proves all
 * 5 fields are real, live-edited fields reused identically across the
 * single-sleeve construction-rules block, styleSleeves, strategicAllocationRanges,
 * and every variant's allocation rows -- source code showing what the editor
 * writes is more authoritative here than sparse sample data. See ROADMAP.md R2's
 * own note flagging this file for re-verification when R3's editor is built.
 */
export interface CapRange {
  sleeveMinPct: number | null
  sleeveMaxPct: number | null
  positionMinPct: number | null
  positionMaxPct: number | null
  /** 'portfolio' | 'sleeve' -- whether position sizing is % of portfolio or % of sleeve. */
  positionBasis: string
}

/**
 * Single-sleeve archetype (e.g. P1 "DSOP"): direct-stock style sleeves.
 * `weightRange` (free-text, e.g. "35-55%") was removed in R3 (post-user-testing)
 * -- it duplicated sleeveMinPct/sleeveMaxPct with no way to keep the two in
 * sync, and the user flagged it as serving no purpose next to the numeric
 * fields. Display now derives from sleeveMinPct/sleeveMaxPct via
 * `formatMinMaxRange()` in lib/capsFormat.ts.
 */
export interface StyleSleeve extends CapRange {
  name: string
  criteria: string
  universe: string
  indicativeNames: string
}

/**
 * Same correction as CapRange above -- sleeveMinPct/sleeveMaxPct/positionMinPct
 * were missing. `stockCountRange`/`cashBuffer` were further corrected in R3
 * (post-user-testing): the frozen app stores these as free-text strings
 * ("15-25", "0-5%"), but the rebuild's Construction Rules section is
 * explicitly "structured, numeric only" (see ProductEditor.tsx), so text
 * inputs here were a real bug, not a deliberate deviation. Replaced with
 * explicit min/max numeric pairs; the one live row that had text values
 * (DSOP) was migrated via a one-off SQL UPDATE, not silently dropped.
 */
export interface PortfolioConstructionRules extends CapRange {
  cashBufferMinPct: number | null
  cashBufferMaxPct: number | null
  sectorCapMaxPct: number | null
  stockCountMin: number | null
  stockCountMax: number | null
}

/**
 * Strategic-allocation archetype (e.g. P2 "DMAP"): fixed sleeve % ranges
 * across asset classes. `range` (free-text, e.g. "5-15%") removed in R3
 * (post-user-testing) for the same reason as StyleSleeve.weightRange above --
 * identical redundancy against sleeveMinPct/sleeveMaxPct, fixed the same way.
 */
export interface AllocationRange extends CapRange {
  sleeve: string
}

/**
 * Risk-variant archetype (e.g. P3/P4/P7/P8): one profile (Aggressive/
 * Moderate/Conservative) per array entry, each with its own allocation
 * table. Re-verified in R3 against the frozen app's actual variant editor
 * (repo root index.html, `renderEdit()`'s variants block): factorMix/
 * universe/stockCount/referenceIndex/rationale are a second, optional field
 * set only some variants carry (systematic/factor-based products), rendered
 * conditionally there via `if(v.factorMix!==undefined)` -- R2's original
 * version omitted these entirely since they weren't in the sampled rows.
 */
export interface RiskVariant {
  profile: string
  targetInvestor?: string
  factorMix?: string
  universe?: string
  stockCount?: string
  referenceIndex?: string
  rationale?: string
  expectedEquityLikeExposure?: string
  allocation?: AllocationRange[]
}

/** Goal-based archetype (e.g. P5/P6/P9): one entry per financial goal type. */
export interface GoalFrameworkEntry {
  goal: string
  horizonBand: string
  glidePath: string
  riskProfileAdjustment: string
}

/**
 * Fields common to every product note archetype, verified against P1-P9's
 * actual `data` jsonb across all 4 archetypes.
 *
 * `selectionMethodology` and `portfolioConstruction` corrected in R3: the
 * frozen app's `renderEdit()`/`renderProduct()`/`DIFF_FIELDS` (repo root
 * index.html) all check these directly on the note object with no archetype
 * guard (`if(p.selectionMethodology!==undefined)`, `if(p.portfolioConstruction!==undefined)`,
 * and `"portfolioConstruction"` is a literal entry in DIFF_FIELDS, compared
 * across every version regardless of archetype) -- i.e. these are optional
 * on any note, not scoped to one archetype. R2's version had
 * `selectionMethodology` only on RiskVariantNote and was missing
 * `portfolioConstruction` entirely.
 */
export interface ProductNoteCommon {
  id: string
  code: string
  name: string
  shortName: string
  category: string
  objective: string
  philosophy: string
  selectionMethodology?: string
  portfolioConstruction?: string
  riskProfile: string
  suitability: string
  keyRisks: string[]
  assetClasses: string[]
  benchmark: string
  minInvestment: string
  rebalanceFrequency: string
  fees: string
  taxNote: string
  regulatoryRegime?: RegulatoryRegime
  /**
   * Disclosures/disclaimer section, added after a compliance review found
   * neither the PDF nor Word exports had one at all. Optional and freeform
   * so each product can carry its own reviewed text; falls back to
   * `lib/disclosures.ts`'s DEFAULT_DISCLOSURES_TEXT (a marked draft) when
   * unset. No migration needed -- this lives in the existing `data` jsonb
   * column, same as every other ProductNoteCommon field.
   */
  disclosures?: string
}

export interface SingleSleeveNote extends ProductNoteCommon {
  styleSleeves: StyleSleeve[]
  portfolioConstructionRules: PortfolioConstructionRules
}

export interface StrategicAllocationNote extends ProductNoteCommon {
  strategicAllocationRanges: AllocationRange[]
  /** Instrument names/tickers by sleeve category, e.g. { reits: "...", invits: "..." }. */
  indicativeInstruments: Record<string, string>
}

export interface RiskVariantNote extends ProductNoteCommon {
  variants: RiskVariant[]
  /** One of these two is present depending on the specific product. */
  sharedInstrumentUniverse?: Record<string, string>
  indicativeInstruments?: Record<string, string>
}

export interface GoalBasedNote extends ProductNoteCommon {
  goalFramework: GoalFrameworkEntry[]
  portfolioConstructionNote: string
}

/**
 * Discriminated union of every product note shape. Notes are discriminated
 * by which optional field is present (styleSleeves / strategicAllocationRanges
 * / variants / goalFramework), matching the frozen app's own approach --
 * there's no literal tag on the note itself (only `templates.archetype`
 * carries one). Narrow via the type guards in `lib/archetype.ts`.
 */
export type ProductNoteData = SingleSleeveNote | StrategicAllocationNote | RiskVariantNote | GoalBasedNote

// ---------- table row types (snake_case, matches actual Postgres columns) ----------

export interface ProductRow {
  id: string
  code: string
  name: string
  short_name: string | null
  category: string
  status: ProductStatus
  archived: boolean
  data: ProductNoteData
  created_at: string
  updated_at: string
  updated_by: string | null
  regulatory_regime: RegulatoryRegime
}

export interface ProductVersionRow {
  id: string
  product_id: string
  version_number: number
  note: string | null
  data: ProductNoteData
  created_at: string
  created_by: string | null
}

export interface TemplateRow {
  id: string
  name: string
  description: string | null
  archetype: Archetype
  data: ProductNoteData
  /**
   * True for the 4 seeded archetype templates (T1-T4). Deletion is blocked
   * for these both at the database level (a BEFORE DELETE trigger, migration
   * `protect_builtin_templates_from_deletion`) and in the UI (ManageTemplatesView.tsx
   * hides the Delete button) -- deleting one breaks the "From Archetype
   * Template" Create path for every user, not just whoever clicked Delete.
   */
  is_builtin: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface PortfolioHoldingRow {
  id: string
  product_id: string
  instrument_code: string
  instrument_name: string
  sleeve: string | null
  weight_pct: number
  sector: string | null
  updated_at: string
  updated_by: string | null
}

/**
 * Compliance-check result shapes -- defined here (not in lib/compliance.ts,
 * which computes them) so this file stays the single source of truth for
 * every persisted shape, matching the rest of this file's own convention.
 * lib/compliance.ts imports these rather than declaring its own copies, to
 * avoid a reverse dependency (this file must not import from lib/, since
 * lib/archetype.ts, data/products.ts, data/templates.ts etc. all import
 * types from here already).
 */
export type ComplianceCheckStatus = 'pass' | 'fail' | 'no-data' | 'manual'

export interface ComplianceCheckItem {
  name: string
  status: ComplianceCheckStatus
  detail: string
}

export interface ComplianceCheckResult {
  compliant: boolean
  checks: ComplianceCheckItem[]
  regime: string
  checkedAt: string
}

/**
 * `event_type` and `compliance_check_result`'s nullability added in R6
 * (migration `holdings_history_event_type_and_csv_upload_audit`) -- this
 * table previously only had one real writer (the compliance-check flow this
 * same phase builds), so `compliance_check_result` was NOT NULL. R4's CSV
 * Constituent Upload writes here too now (via the extended
 * `replace_portfolio_holdings` RPC), and an upload has no check result to
 * report -- just a snapshot of what the holdings became. A DB check
 * constraint enforces the pairing: `compliance_check` rows always carry a
 * result, `csv_upload` rows never do; this type mirrors that with
 * `ComplianceCheckResult | null` rather than leaving it always-required.
 */
export interface PortfolioHoldingHistoryRow {
  id: string
  product_id: string
  rebalance_number: number
  holdings_snapshot: PortfolioHoldingRow[]
  event_type: 'compliance_check' | 'csv_upload'
  compliance_check_result: ComplianceCheckResult | null
  approved_by: string | null
  created_at: string
  created_by: string | null
}
