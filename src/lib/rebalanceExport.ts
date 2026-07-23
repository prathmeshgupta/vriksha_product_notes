import { saveAs } from 'file-saver'
import type { HoldingsDiffRow } from './holdingsDiff'

/**
 * "Build our own smallcase alternative" scoped down to what's actually
 * buildable without smallcase's API credentials (which this app has never
 * had, and which only the user can obtain): rather than a live, authenticated
 * push to smallcase's rebalance endpoints, this generates a plain,
 * well-formatted rebalance-instruction file from the same diff this app
 * already computes (see holdingsDiff.ts). That file is handed to whatever
 * actually executes the trade -- smallcase's own bulk-upload tools, a
 * broker/dealer desk, or a manual process -- the same way CSV Constituent
 * Upload already works in the opposite direction (importing holdings INTO
 * this app). If real API credentials become available later, this same
 * diff data is exactly what a direct API push would need to send; the
 * export is a strict subset of that work, not wasted effort.
 */
export interface RebalanceExportRow {
  action: 'BUY (new)' | 'SELL (exit)' | 'INCREASE' | 'DECREASE' | 'HOLD'
  instrument_code: string
  instrument_name: string
  old_weight_pct: string
  new_weight_pct: string
  delta_pct: string
}

function actionFor(row: HoldingsDiffRow): RebalanceExportRow['action'] {
  if (row.status === 'added') return 'BUY (new)'
  if (row.status === 'removed') return 'SELL (exit)'
  if (row.status === 'changed') {
    return (row.newWeight ?? 0) > (row.oldWeight ?? 0) ? 'INCREASE' : 'DECREASE'
  }
  return 'HOLD'
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function buildRebalanceExportRows(diffRows: HoldingsDiffRow[]): RebalanceExportRow[] {
  return diffRows
    .filter((r) => r.status !== 'unchanged')
    .map((r) => ({
      action: actionFor(r),
      instrument_code: r.instrument_code,
      instrument_name: r.instrument_name,
      old_weight_pct: r.oldWeight != null ? r.oldWeight.toFixed(2) : '',
      new_weight_pct: r.newWeight != null ? r.newWeight.toFixed(2) : '',
      delta_pct: r.oldWeight != null && r.newWeight != null ? (r.newWeight - r.oldWeight).toFixed(2) : '',
    }))
}

export function downloadRebalanceExportCsv(diffRows: HoldingsDiffRow[], productCode: string, label: string) {
  const rows = buildRebalanceExportRows(diffRows)
  const header = ['Action', 'Instrument Code', 'Instrument Name', 'Old Weight %', 'New Weight %', 'Delta %']
  const lines = [
    header.join(','),
    ...rows.map((r) => [r.action, r.instrument_code, r.instrument_name, r.old_weight_pct, r.new_weight_pct, r.delta_pct].map(csvEscape).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const safeLabel = label.replace(/[^a-z0-9]+/gi, '_')
  saveAs(blob, `${productCode}_rebalance_instructions_${safeLabel}.csv`)
}
