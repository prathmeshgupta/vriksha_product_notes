import type { StyleSleeve } from '../../../data/types'
import { CapFieldsRow } from '../shared/CapFieldsRow'
import { WeightSumBadge } from '../shared/WeightSumBadge'
import { Button } from '../../../design-system'

export interface SleeveEditorProps {
  sleeves: StyleSleeve[]
  onChange: (sleeves: StyleSleeve[]) => void
}

const BLANK_SLEEVE: StyleSleeve = {
  name: 'New Sleeve',
  criteria: '',
  universe: '',
  indicativeNames: '',
  sleeveMinPct: null,
  sleeveMaxPct: null,
  positionMinPct: null,
  positionMaxPct: null,
  positionBasis: 'portfolio',
}

/**
 * Style sleeves editor (single-sleeve archetype, e.g. P1). Matches the
 * frozen app's sleeve editor block inside `renderEdit()` (repo root
 * index.html) field-for-field.
 */
export function SleeveEditor({ sleeves, onChange }: SleeveEditorProps) {
  function updateSleeve(idx: number, patch: Partial<StyleSleeve>) {
    onChange(sleeves.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  function removeSleeve(idx: number) {
    onChange(sleeves.filter((_, i) => i !== idx))
  }
  function addSleeve() {
    onChange([...sleeves, { ...BLANK_SLEEVE }])
  }

  return (
    <>
      {sleeves.map((s, i) => (
        <div key={i}>
          <div className="editable-table-row">
            <input
              type="text"
              value={s.name}
              placeholder="Sleeve name"
              onChange={(e) => updateSleeve(i, { name: e.target.value })}
            />
            <input
              type="text"
              value={s.universe || ''}
              placeholder="Universe"
              onChange={(e) => updateSleeve(i, { universe: e.target.value })}
            />
            <input
              type="text"
              value={s.indicativeNames || ''}
              placeholder="Indicative names"
              onChange={(e) => updateSleeve(i, { indicativeNames: e.target.value })}
            />
            <button className="row-remove" onClick={() => removeSleeve(i)}>
              ×
            </button>
          </div>
          <CapFieldsRow value={s} onChange={(patch) => updateSleeve(i, patch)} />
          <textarea
            rows={2}
            style={{ marginBottom: 14 }}
            value={s.criteria || ''}
            placeholder="Selection criteria"
            onChange={(e) => updateSleeve(i, { criteria: e.target.value })}
          />
        </div>
      ))}
      <WeightSumBadge ranges={sleeves.map((s) => ({ min: s.sleeveMinPct, max: s.sleeveMaxPct }))} />
      <div style={{ marginTop: 12 }}>
        <Button size="small" onClick={addSleeve}>
          + Add Sleeve
        </Button>
      </div>
    </>
  )
}
