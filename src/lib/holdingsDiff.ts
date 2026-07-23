import type { PortfolioHoldingRow } from '../data/types'

/**
 * Row-level diff between two holdings snapshots, matched by instrument_code.
 * Built for the in-app "Upgrade Roadmap" page's "Live constituent management
 * UI" item ("diff view against the prior rebalance") -- see
 * ProductCompliance.tsx for where this renders.
 *
 * Deliberately NOT reusing lib/diff.ts's word-level diffText(): that's built
 * for comparing two versions of prose (objective, philosophy, etc.), where
 * "what changed" means which words moved. Holdings are structured rows keyed
 * by instrument_code, and the meaningful question is different: which
 * instruments were added, which were dropped, and for the ones that stayed,
 * did the weight change. A row-level set/map diff answers that directly and
 * is far cheaper than treating the snapshot as text.
 */
export type HoldingsDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged'

export interface HoldingsDiffRow {
  instrument_code: string
  instrument_name: string
  status: HoldingsDiffStatus
  oldWeight: number | null
  newWeight: number | null
}

const STATUS_RANK: Record<HoldingsDiffStatus, number> = { added: 0, removed: 1, changed: 2, unchanged: 3 }

/** `from` is the older snapshot, `to` is the newer one -- same convention as VersionHistory.tsx's diff direction. */
export function diffHoldings(from: PortfolioHoldingRow[], to: PortfolioHoldingRow[]): HoldingsDiffRow[] {
  const fromMap = new Map(from.map((h) => [h.instrument_code, h]))
  const toMap = new Map(to.map((h) => [h.instrument_code, h]))
  const codes = new Set([...fromMap.keys(), ...toMap.keys()])

  const rows: HoldingsDiffRow[] = []
  for (const code of codes) {
    const o = fromMap.get(code)
    const n = toMap.get(code)
    if (o && !n) {
      rows.push({ instrument_code: code, instrument_name: o.instrument_name, status: 'removed', oldWeight: o.weight_pct, newWeight: null })
    } else if (!o && n) {
      rows.push({ instrument_code: code, instrument_name: n.instrument_name, status: 'added', oldWeight: null, newWeight: n.weight_pct })
    } else if (o && n) {
      const changed = Math.abs(o.weight_pct - n.weight_pct) > 0.005
      rows.push({
        instrument_code: code,
        instrument_name: n.instrument_name,
        status: changed ? 'changed' : 'unchanged',
        oldWeight: o.weight_pct,
        newWeight: n.weight_pct,
      })
    }
  }

  rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.instrument_code.localeCompare(b.instrument_code))
  return rows
}

/** True if the diff has anything worth showing beyond "everything is the same". */
export function hasHoldingsChanges(rows: HoldingsDiffRow[]): boolean {
  return rows.some((r) => r.status !== 'unchanged')
}
