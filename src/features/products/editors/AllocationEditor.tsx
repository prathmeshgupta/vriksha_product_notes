import type { AllocationRange } from '../../../data/types'
import { CapFieldsRow } from '../shared/CapFieldsRow'
import { WeightSumBadge } from '../shared/WeightSumBadge'
import { Button } from '../../../design-system'

export interface AllocationEditorProps {
  allocations: AllocationRange[]
  onChange: (allocations: AllocationRange[]) => void
  /** Label on the "add row" button, e.g. "+ Add Sleeve" (matches frozen app's copy). */
  addLabel?: string
}

const BLANK_ALLOCATION: AllocationRange = {
  sleeve: '',
  sleeveMinPct: null,
  sleeveMaxPct: null,
  positionMinPct: null,
  positionMaxPct: null,
  positionBasis: 'portfolio',
}

/**
 * Shared allocation-range row editor: used for strategicAllocationRanges
 * (strategic-allocation archetype, e.g. P2) and reused inside VariantEditor
 * for each risk-profile variant's own allocation table (e.g. P3/P4/P7/P8).
 * Matches the frozen app's `updateAllocField`/`updateAllocNumericField`/
 * `addAllocRow`/`removeAllocRow` block in `renderEdit()` exactly.
 */
export function AllocationEditor({ allocations, onChange, addLabel = '+ Add Sleeve' }: AllocationEditorProps) {
  function update(idx: number, patch: Partial<AllocationRange>) {
    onChange(allocations.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }
  function remove(idx: number) {
    onChange(allocations.filter((_, i) => i !== idx))
  }
  function add() {
    onChange([...allocations, { ...BLANK_ALLOCATION }])
  }

  return (
    <>
      {allocations.map((a, i) => (
        <div key={i}>
          <div className="editable-table-row two">
            <input type="text" value={a.sleeve} placeholder="Sleeve" onChange={(e) => update(i, { sleeve: e.target.value })} />
            <button className="row-remove" onClick={() => remove(i)}>
              ×
            </button>
          </div>
          <CapFieldsRow value={a} onChange={(patch) => update(i, patch)} />
        </div>
      ))}
      <WeightSumBadge ranges={allocations.map((a) => ({ min: a.sleeveMinPct, max: a.sleeveMaxPct }))} />
      <div style={{ marginTop: 12 }}>
        <Button size="small" onClick={add}>
          {addLabel}
        </Button>
      </div>
    </>
  )
}
