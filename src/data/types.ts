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

export interface CapRange {
  sleeveMinPct: number | null
  sleeveMaxPct: number | null
}

/** Single-sleeve archetype (e.g. P1 "DSOP"): direct-stock style sleeves. */
export interface StyleSleeve extends CapRange {
  name: string
  criteria: string
  universe: string
  weightRange: string
  indicativeNames: string
}

export interface PortfolioConstructionRules {
  cashBuffer: string
  positionBasis: string
  positionMaxPct: number | null
  sectorCapMaxPct: number | null
  stockCountRange: string
}

/** Strategic-allocation archetype (e.g. P2 "DMAP"): fixed sleeve % ranges across asset classes. */
export interface AllocationRange extends CapRange {
  sleeve: string
  range: string
}

/**
 * Risk-variant archetype (e.g. P3/P4/P7/P8): one profile (Aggressive/
 * Moderate/Conservative) per array entry, each with its own allocation
 * table. Re-verify field-by-field in R3 when the risk-variant editor is
 * built -- indicativeInstruments/selectionMethodology/sharedInstrumentUniverse
 * vary by which specific product this is (ETF/REIT/InvIT vs MF vs systematic),
 * typed here as Record<string, string> since their key sets differ.
 */
export interface RiskVariant {
  profile: string
  targetInvestor: string
  expectedEquityLikeExposure: string
  allocation: AllocationRange[]
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
 */
export interface ProductNoteCommon {
  id: string
  code: string
  name: string
  shortName: string
  category: string
  objective: string
  philosophy: string
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
  /** One of these three is present depending on the specific product; re-verify in R3. */
  sharedInstrumentUniverse?: Record<string, string>
  indicativeInstruments?: Record<string, string>
  selectionMethodology?: string
}

export interface GoalBasedNote extends ProductNoteCommon {
  goalFramework: GoalFrameworkEntry[]
  portfolioConstructionNote: string
}

/** Discriminated union of every product note shape. Narrow via `getArchetype()` in products.ts. */
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
 * compliance_check_result shape matches the frozen app's runComplianceCheck()
 * output -- ported precisely when compliance.ts is built in R6, typed as
 * Record<string, unknown> here since R2 doesn't yet re-implement the
 * compliance engine itself (see rebuild/ROADMAP.md R6).
 */
export interface PortfolioHoldingHistoryRow {
  id: string
  product_id: string
  rebalance_number: number
  holdings_snapshot: PortfolioHoldingRow[]
  compliance_check_result: Record<string, unknown>
  approved_by: string | null
  created_at: string
  created_by: string | null
}
