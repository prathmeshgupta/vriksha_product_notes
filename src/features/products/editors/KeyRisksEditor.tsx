export interface KeyRisksEditorProps {
  risks: string[]
  onChange: (risks: string[]) => void
}

/** Key risks list editor. Matches the frozen app's risk-item-row block exactly. */
export function KeyRisksEditor({ risks, onChange }: KeyRisksEditorProps) {
  function update(idx: number, value: string) {
    onChange(risks.map((r, i) => (i === idx ? value : r)))
  }
  function remove(idx: number) {
    onChange(risks.filter((_, i) => i !== idx))
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
    </div>
  )
}

/** Appends a blank risk row -- matches the frozen app's `addRisk()` toolbar button. */
export function addBlankRisk(risks: string[]): string[] {
  return [...risks, '']
}
