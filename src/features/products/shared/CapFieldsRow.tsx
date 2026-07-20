import type { CapRange } from '../../../data/types'
import { clampPct } from '../../../lib/capsFormat'
import '../products.css'

export interface CapFieldsRowProps {
  value: CapRange
  onChange: (patch: Partial<CapRange>) => void
}

/**
 * Shared row of 5 numeric-only inputs: sleeve allocation range (min/max %)
 * plus a true position-size range (min/max %) and its basis. Reused across
 * the single-sleeve construction-rules block, styleSleeves, strategicAllocationRanges,
 * and every variant's allocation rows -- matches the frozen app's
 * `capFieldsHtml()` (repo root index.html) exactly, so all 4 editors stay
 * visually and behaviorally identical rather than drifting apart.
 */
export function CapFieldsRow({ value, onChange }: CapFieldsRowProps) {
  const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : v)

  return (
    <div className="cap-fields-row">
      <label>
        Sleeve min %
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          className="input-sm"
          value={num(value.sleeveMinPct)}
          placeholder="—"
          onChange={(e) => onChange({ sleeveMinPct: clampPct(e.target.value) })}
        />
      </label>
      <label>
        Sleeve max %
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          className="input-sm"
          value={num(value.sleeveMaxPct)}
          placeholder="—"
          onChange={(e) => onChange({ sleeveMaxPct: clampPct(e.target.value) })}
        />
      </label>
      <label>
        Position min %
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          className="input-sm"
          value={num(value.positionMinPct)}
          placeholder="—"
          onChange={(e) => onChange({ positionMinPct: clampPct(e.target.value) })}
        />
      </label>
      <label>
        Position max %
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          className="input-sm"
          value={num(value.positionMaxPct)}
          placeholder="—"
          onChange={(e) => onChange({ positionMaxPct: clampPct(e.target.value) })}
        />
      </label>
      <label>
        Basis
        <select
          style={{ width: 130 }}
          value={value.positionBasis || 'portfolio'}
          onChange={(e) => onChange({ positionBasis: e.target.value })}
        >
          <option value="portfolio">% of portfolio</option>
          <option value="sleeve">% of sleeve</option>
        </select>
      </label>
    </div>
  )
}
