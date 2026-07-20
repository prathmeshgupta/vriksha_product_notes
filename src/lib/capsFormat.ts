import type { PortfolioConstructionRules } from '../data/types'

/**
 * Parses free user input into a number in [0,100] or null if not a valid
 * number. Ported verbatim from the frozen app's `clampPct()` (repo root
 * index.html) -- used for every structured cap/range field so bad input can
 * never silently become NaN or a negative/absurd percentage in the data.
 */
export function clampPct(value: string): number | null {
  if (value === '' || value === null || value === undefined) return null
  const n = parseFloat(value)
  if (isNaN(n)) return null
  return Math.max(0, Math.min(100, n))
}

/**
 * Single source of truth for the human-readable caps sentence -- ported
 * verbatim from the frozen app's `formatCapsSentence()` (repo root
 * index.html). Reused for both the read-only note view (this file) and,
 * later, every export format (R4), so there is exactly one place a cap
 * sentence is ever generated from the underlying numbers.
 */
export function formatCapsSentence(rules: PortfolioConstructionRules | null | undefined): string {
  if (!rules) return '—'
  const parts: string[] = []
  if (rules.positionMinPct != null || rules.positionMaxPct != null) {
    const lo = rules.positionMinPct != null ? rules.positionMinPct + '%' : 'no minimum'
    const hi = rules.positionMaxPct != null ? rules.positionMaxPct + '%' : 'no maximum'
    const basis = rules.positionBasis === 'sleeve' ? 'of sleeve' : 'of portfolio'
    parts.push(`Position size ${lo}–${hi} ${basis}`)
  }
  if (rules.sectorCapMaxPct != null) {
    parts.push(`Sector cap ${rules.sectorCapMaxPct}%`)
  }
  if (rules.sleeveMinPct != null || rules.sleeveMaxPct != null) {
    const lo = rules.sleeveMinPct != null ? rules.sleeveMinPct + '%' : '—'
    const hi = rules.sleeveMaxPct != null ? rules.sleeveMaxPct + '%' : '—'
    parts.push(`Equity exposure ${lo}–${hi}`)
  }
  return parts.length ? parts.join('; ') : '—'
}

/**
 * Renders a min/max numeric pair as a "15–25" style range string, or '—' if
 * both ends are unset. Added in R3 (post-user-testing) alongside converting
 * stockCountRange/cashBuffer and the sleeve/allocation weight-range fields
 * from free text to structured min/max numbers -- this is the single place
 * those numbers become a display string, mirroring formatCapsSentence's role
 * for the cap fields.
 */
export function formatMinMaxRange(min: number | null | undefined, max: number | null | undefined, suffix = ''): string {
  if (min == null && max == null) return '—'
  const lo = min != null ? `${min}${suffix}` : '—'
  const hi = max != null ? `${max}${suffix}` : '—'
  return `${lo}–${hi}`
}
