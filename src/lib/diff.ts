/**
 * Word-level diff for the version-history "diff vs prior version" view.
 * Ported verbatim from the frozen app's `diffText()` / `DIFF_FIELDS`
 * (repo root index.html) -- same simple LCS approach, same field list.
 * Rendering (renderDiffHtml there) becomes a React component in
 * VersionHistory.tsx instead of an HTML-string builder, but the diffing
 * logic itself is unchanged.
 */

/** Fields compared in diffs -- covers the freeform + key structured summary fields. */
export const DIFF_FIELDS = [
  'objective',
  'philosophy',
  'selectionMethodology',
  'portfolioConstruction',
  'benchmark',
  'rebalanceFrequency',
  'riskProfile',
  'suitability',
  'minInvestment',
  'fees',
  'taxNote',
] as const

export function fieldValueAt(dataObj: Record<string, unknown>, field: string): string {
  return dataObj[field] !== undefined ? String(dataObj[field]) : ''
}

export interface DiffToken {
  t: 'same' | 'del' | 'add'
  v: string
}

/**
 * `tsconfig.app.json` has `noUncheckedIndexedAccess: true` (a real R0
 * strictness decision, not something to work around by disabling it), which
 * types every `array[i]` as `T | undefined`. This classic DP-table LCS
 * algorithm indexes strictly within bounds it just allocated -- true at
 * every call site below by loop construction -- so a single, narrowly-scoped
 * non-null assertion here is more honest than threading `undefined` checks
 * through arithmetic that can never actually see one.
 */
function at<T>(arr: T[], i: number): T {
  return arr[i]!
}

export function diffText(a: string, b: string): DiffToken[] {
  const aw = (a || '').split(/(\s+)/)
  const bw = (b || '').split(/(\s+)/)
  const m = aw.length
  const n = bw.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      at(dp, i)[j] = at(aw, i) === at(bw, j) ? at(at(dp, i + 1), j + 1) + 1 : Math.max(at(at(dp, i + 1), j), at(at(dp, i), j + 1))
    }
  }
  let i = 0
  let j = 0
  const out: DiffToken[] = []
  while (i < m && j < n) {
    if (at(aw, i) === at(bw, j)) {
      out.push({ t: 'same', v: at(aw, i) })
      i++
      j++
    } else if (at(at(dp, i + 1), j) >= at(at(dp, i), j + 1)) {
      out.push({ t: 'del', v: at(aw, i) })
      i++
    } else {
      out.push({ t: 'add', v: at(bw, j) })
      j++
    }
  }
  while (i < m) {
    out.push({ t: 'del', v: at(aw, i) })
    i++
  }
  while (j < n) {
    out.push({ t: 'add', v: at(bw, j) })
    j++
  }
  return out
}
