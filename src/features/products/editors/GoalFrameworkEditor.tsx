import type { GoalFrameworkEntry } from '../../../data/types'
import { FieldRow, TextAreaField } from '../../../design-system'

export interface GoalFrameworkEditorProps {
  goals: GoalFrameworkEntry[]
  onChange: (goals: GoalFrameworkEntry[]) => void
}

/**
 * Life Goal Framework editor (goal-based archetype, e.g. P5/P6/P9). Matches
 * the frozen app's goal framework block in `renderEdit()` exactly. Note this
 * section is labelled "freeform" in the frozen app (not add/remove-row
 * editable there), so this ports the same fixed-entries editing behavior --
 * adding/removing goal entries is not part of the frozen app's editor either.
 */
export function GoalFrameworkEditor({ goals, onChange }: GoalFrameworkEditorProps) {
  function update(idx: number, patch: Partial<GoalFrameworkEntry>) {
    onChange(goals.map((g, i) => (i === idx ? { ...g, ...patch } : g)))
  }

  return (
    <>
      {goals.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--canopy)' }}>
          <FieldRow label="Goal">
            <input type="text" value={g.goal} onChange={(e) => update(gi, { goal: e.target.value })} />
          </FieldRow>
          <FieldRow label="Horizon Band">
            <input type="text" value={g.horizonBand} onChange={(e) => update(gi, { horizonBand: e.target.value })} />
          </FieldRow>
          <TextAreaField
            label="Glide Path"
            rows={3}
            value={g.glidePath || ''}
            onChange={(e) => update(gi, { glidePath: e.target.value })}
          />
          {g.riskProfileAdjustment !== undefined && (
            <TextAreaField
              label="Risk Adjustment"
              rows={2}
              value={g.riskProfileAdjustment || ''}
              onChange={(e) => update(gi, { riskProfileAdjustment: e.target.value })}
            />
          )}
        </div>
      ))}
    </>
  )
}
