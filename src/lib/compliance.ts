import type { CapRange, ComplianceCheckItem, ComplianceCheckResult, PortfolioHoldingRow, ProductNoteData } from '../data/types'
import { isRiskVariant, isSingleSleeve, isStrategicAllocation } from './archetype'

/**
 * Regime-scoped compliance-check engine -- ported from the frozen app's
 * `getEffectiveCapThresholds()`/`runComplianceCheck()` (repo root
 * index.html), rebuilt as pure, typed, no-I/O functions rather than reading
 * off global `state.products`/`state.holdings`. Callers (data/holdings.ts's
 * `recordComplianceCheck`, the Compliance UI) pass in the product/holdings
 * they already have; nothing here touches Supabase directly, which is what
 * makes this the one part of the rebuild ROADMAP.md explicitly calls out as
 * worth real unit tests -- given the same (product, holdings) input, the
 * output is deterministic.
 *
 * Field-name-adapted like every other ported module: the frozen app reads
 * `p.portfolioConstructionRules`/`p.styleSleeves`/etc. off an untyped object
 * with no archetype guard; here the equivalent access goes through
 * `lib/archetype.ts`'s type guards, since `ProductNoteData` is a
 * discriminated union where those fields only exist on specific members.
 */

// ComplianceCheckStatus/ComplianceCheckItem/ComplianceCheckResult live in
// data/types.ts, not here -- see that file's comment on why (this file must
// not become something data/types.ts depends on, since types.ts is the
// foundational file every data-layer module already imports from).

export interface EffectiveCapThresholds {
  positionMinPct: number | null
  positionMaxPct: number | null
  positionBasis: string
  sectorCapMaxPct: number | null
}

/**
 * Pulls the applicable position-size and sector-cap thresholds out of a
 * product's note, regardless of which of the 4 archetype shapes it uses.
 * Sleeve/variant-level caps take priority over the top-level
 * portfolioConstructionRules when both exist (take the tightest -- lowest
 * max, highest min -- across all of them), matching the frozen app's
 * "conservative by design" comment exactly: compliance should flag against
 * the strictest applicable limit, not the loosest.
 */
export function getEffectiveCapThresholds(p: ProductNoteData): EffectiveCapThresholds {
  const rules = isSingleSleeve(p) ? p.portfolioConstructionRules : undefined
  let positionMinPct = rules?.positionMinPct ?? null
  let positionMaxPct = rules?.positionMaxPct ?? null
  let positionBasis = rules?.positionBasis || 'portfolio'
  const sectorCapMaxPct = rules?.sectorCapMaxPct ?? null

  const sleeveLike: CapRange[] = isSingleSleeve(p)
    ? p.styleSleeves
    : isStrategicAllocation(p)
      ? p.strategicAllocationRanges
      : isRiskVariant(p)
        ? p.variants.flatMap((v) => v.allocation || [])
        : []

  sleeveLike.forEach((s) => {
    if (s.positionMinPct != null) positionMinPct = positionMinPct == null ? s.positionMinPct : Math.max(positionMinPct, s.positionMinPct)
    if (s.positionMaxPct != null) positionMaxPct = positionMaxPct == null ? s.positionMaxPct : Math.min(positionMaxPct, s.positionMaxPct)
    if (s.positionBasis) positionBasis = s.positionBasis
  })

  return { positionMinPct, positionMaxPct, positionBasis, sectorCapMaxPct }
}

/**
 * Runs the regime-appropriate check set against a product's current
 * holdings. Compliant only if every mechanically-checkable item passes;
 * "no-data" and "manual" items don't block, since they either have nothing
 * to check or require a human -- matches the frozen app's exact semantics.
 */
export function runComplianceCheck(product: ProductNoteData, holdings: PortfolioHoldingRow[]): ComplianceCheckResult {
  const regime = product.regulatoryRegime || 'india_sebi'
  const checks: ComplianceCheckItem[] = []

  // Universal check -- applies regardless of regime.
  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.weight_pct) || 0), 0)
  const weightOk = holdings.length > 0 && Math.abs(totalWeight - 100) <= 0.5
  checks.push({
    name: 'Weights sum to 100%',
    status: holdings.length === 0 ? 'no-data' : weightOk ? 'pass' : 'fail',
    detail: holdings.length === 0 ? 'No holdings entered yet.' : `Current total: ${totalWeight.toFixed(2)}% (tolerance ±0.5%).`,
  })

  if (regime === 'india_sebi') {
    const { positionMaxPct, positionBasis, sectorCapMaxPct } = getEffectiveCapThresholds(product)

    // Single-stock concentration cap.
    if (positionMaxPct != null) {
      const basisLabel = positionBasis === 'sleeve' ? 'within its sleeve' : 'of portfolio'
      const breaches = holdings.filter((h) => Number(h.weight_pct) > positionMaxPct)
      checks.push({
        name: `Single-stock cap (max ${positionMaxPct}% ${basisLabel})`,
        status: breaches.length ? 'fail' : 'pass',
        detail: breaches.length
          ? `Breaches: ${breaches.map((h) => `${h.instrument_name || h.instrument_code} at ${h.weight_pct}%`).join(', ')}.`
          : 'No holding exceeds the cap.',
      })
    } else {
      checks.push({
        name: 'Single-stock cap',
        status: 'no-data',
        detail: "No position-size maximum is set on this product's note — nothing to check against.",
      })
    }

    // Sector concentration cap.
    if (sectorCapMaxPct != null) {
      const bySector: Record<string, number> = {}
      holdings.forEach((h) => {
        if (!h.sector) return
        bySector[h.sector] = (bySector[h.sector] || 0) + (Number(h.weight_pct) || 0)
      })
      const breaches = Object.entries(bySector).filter(([, w]) => w > sectorCapMaxPct)
      checks.push({
        name: `Sector cap (max ${sectorCapMaxPct}%)`,
        status: breaches.length ? 'fail' : 'pass',
        detail: breaches.length
          ? `Breaches: ${breaches.map(([s, w]) => `${s} at ${w.toFixed(1)}%`).join(', ')}.`
          : holdings.some((h) => !h.sector)
            ? 'No breach among holdings with a sector tagged. Some holdings have no sector set.'
            : 'No sector exceeds the cap.',
      })
    } else {
      checks.push({
        name: 'Sector cap',
        status: 'no-data',
        detail: "No sector cap is set on this product's note — nothing to check against.",
      })
    }

    // Risk-profile-to-allocation consistency -- only meaningful for
    // Conservative variants with an explicit equity-like exposure
    // expectation; otherwise no-data, not a failure.
    if (isRiskVariant(product)) {
      const conservative = product.variants.find((v) => (v.profile || '').toLowerCase().includes('conservative'))
      if (conservative && conservative.expectedEquityLikeExposure) {
        checks.push({
          name: 'Risk-profile-to-allocation consistency (Conservative)',
          status: 'no-data',
          detail: `Expected equity-like exposure for Conservative: ${conservative.expectedEquityLikeExposure}. Not mechanically checked against live holdings yet — confirm manually.`,
        })
      }
    }

    // Model portfolio disclosure completeness -- SEBI's 8-Jan-2025 circular
    // "Guidelines for Investment Advisers" / the parallel RA circular
    // (aligned with the Dec-2024 SEBI (Research Analysts) Regulations, 2014
    // and SEBI (Investment Adviser) Regulations, 2013 amendments) brought
    // "model portfolios" -- a basket of securities for which a research
    // report is issued -- within the scope of research services, and
    // requires RAs/IAs offering them to define and disclose: methodology,
    // frequency of portfolio review/rebalancing, benchmarking, and
    // investment horizon, for each such portfolio. Compliance required by
    // 30-Jun-2025 for RAs already offering model portfolios.
    // (https://www.sebi.gov.in/legal/circulars/jan-2025/guidelines-for-investment-advisers_90632.html)
    //
    // This is genuinely mechanically checkable -- unlike the deeper
    // regulatory judgment calls below, "is the required disclosure text
    // present" is a presence check, not an interpretation of the rule. Kept
    // separate from the general disclosure checklist item below (which
    // covers everything else that still needs a human).
    const methodology = product.selectionMethodology || product.portfolioConstruction || ''
    const missingDisclosures: string[] = []
    if (!product.objective.trim()) missingDisclosures.push('objective')
    if (!methodology.trim()) missingDisclosures.push('selection methodology / portfolio construction')
    if (!product.benchmark.trim()) missingDisclosures.push('benchmark')
    if (!product.rebalanceFrequency.trim()) missingDisclosures.push('rebalance frequency')
    if (!product.riskProfile.trim()) missingDisclosures.push('risk profile (investment horizon proxy)')
    if (!product.suitability.trim()) missingDisclosures.push('suitability')
    checks.push({
      name: 'Model portfolio disclosure completeness (SEBI, Jan 2025 circular)',
      status: missingDisclosures.length ? 'fail' : 'pass',
      detail: missingDisclosures.length
        ? `Missing required disclosure(s): ${missingDisclosures.join(', ')}.`
        : 'Methodology, benchmark, rebalance frequency, risk profile, and suitability are all populated.',
    })

    // Everything else the Jan-2025 circular and general SEBI disclosure
    // practice expects (e.g. that the disclosed methodology is actually
    // accurate, that research-report-per-constituent obligations are met,
    // conflict-of-interest disclosures, etc.) requires human judgment this
    // engine can't verify from the note's text alone.
    checks.push({
      name: 'SEBI disclosure requirement checklist',
      status: 'manual',
      detail: 'Human-confirmed item — not automatically checked. Confirm required disclosures are accurate and current before publishing.',
    })
  } else {
    checks.push({
      name: `Regime-specific checks (${regime})`,
      status: 'no-data',
      detail: 'No regime-specific rules are defined for this regime yet — only the universal weights check applies. See ARCHITECTURE.md §2.4.',
    })
  }

  const compliant = checks.every((c) => c.status !== 'fail')
  return { compliant, checks, regime, checkedAt: new Date().toISOString() }
}
