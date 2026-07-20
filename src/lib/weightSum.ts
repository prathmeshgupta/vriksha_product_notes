/**
 * Rough validation signal for a set of sleeve/allocation weight ranges: sums
 * the low and high end of each range so the editor can flag "these ranges
 * don't plausibly bracket 100%". Ported from the frozen app's
 * `sumRangeHighs()` / weight-sum-badge logic (repo root index.html), which
 * parsed free-text "35-55%" strings via regex.
 *
 * R3 (post-user-testing) removed the redundant free-text weight-range fields
 * next to the structured sleeveMinPct/sleeveMaxPct numeric inputs (the user
 * flagged this as "serves no purpose" for the sleeve editor; the identical
 * pattern in the allocation editor was fixed the same way). With no free
 * text left to parse, this now sums the numeric fields directly instead of
 * round-tripping through a regex -- simpler and removes a source of parse
 * bugs, not just a like-for-like port.
 */
export interface MinMaxRange {
  min: number | null
  max: number | null
}

export function sumRanges(rows: MinMaxRange[]): { lo: number; hi: number } {
  let lo = 0
  let hi = 0
  rows.forEach((r) => {
    if (r.min != null) lo += r.min
    if (r.max != null) hi += r.max
    else if (r.min != null) hi += r.min
  })
  return { lo, hi }
}

export interface WeightSumResult {
  lo: number
  hi: number
  ok: boolean
}

/** Loose band check: ranges should plausibly cover ~100%. Same threshold as the frozen app. */
export function weightSumCheck(rows: MinMaxRange[]): WeightSumResult {
  const { lo, hi } = sumRanges(rows)
  const ok = lo <= 100 && hi >= 95 && hi <= 115
  return { lo, hi, ok }
}
