import { Button } from '../../../design-system'

export interface KeyRisksEditorProps {
  risks: string[]
  onChange: (risks: string[]) => void
}

/**
 * Key risks list editor. Risk-item-row markup matches the frozen app's block
 * exactly. The "+ Add Risk" button now lives here, at the bottom of the
 * list, rather than in ProductEditor.tsx's page-level top toolbar (moved
 * after user feedback during R4 functional verification -- it was the only
 * "add row" control on the whole editor that didn't live next to the list it
 * affects). Matches every sibling array editor's own convention exactly
 * (see SleeveEditor.tsx's addSleeve()/"+ Add Sleeve", AllocationEditor.tsx,
 * VariantEditor.tsx, GoalFrameworkEditor.tsx), so Key Risks was the one
 * inconsistent case, not a deliberate difference.
 */
export function KeyRisksEditor({ risks, onChange }: KeyRisksEditorProps) {
  function update(idx: number, value: string) {
    onChange(risks.map((r, i) => (i === idx ? value : r)))
  }
  function remove(idx: number) {
    onChange(risks.filter((_, i) => i !== idx))
  }
  function add() {
    onChange([...risks, ''])
  }

  return (
    <div>
      {risks.map((r, i) => (
        <div className="risk-item-row" key={i}>
          <input type="text" value={r} onChange={(e) => update(i, e.target.value)} />
          <button className="row-remove" onClick={() => remove(i)}>
            ×
          </button>
        </div>
      ))}
      <div style={{ marginTop: 12 }}>
        <Button size="small" onClick={add}>
          + Add Risk
        </Button>
      </div>
    </div>
  )
}
