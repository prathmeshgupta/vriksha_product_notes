import type { RiskVariant } from '../../../data/types'
import { AllocationEditor } from './AllocationEditor'
import { FieldRow, TextAreaField } from '../../../design-system'

export interface VariantEditorProps {
  variants: RiskVariant[]
  onChange: (variants: RiskVariant[]) => void
}

/**
 * Risk-profile variants editor (risk-variant archetype, e.g. P3/P4/P7/P8).
 * Matches the frozen app's variants block in `renderEdit()` exactly,
 * including which fields are conditionally shown per variant (factorMix
 * block only for systematic/factor-based variants, allocation table only
 * when the variant has one).
 */
export function VariantEditor({ variants, onChange }: VariantEditorProps) {
  function update(idx: number, patch: Partial<RiskVariant>) {
    onChange(variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  return (
    <>
      {variants.map((v, vi) => (
        <div
          key={vi}
          style={{ marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--canopy)' }}
        >
          <FieldRow label="Profile Name">
            <input type="text" value={v.profile} onChange={(e) => update(vi, { profile: e.target.value })} />
          </FieldRow>

          {v.targetInvestor !== undefined && (
            <TextAreaField
              label="Target Investor"
              rows={2}
              value={v.targetInvestor || ''}
              onChange={(e) => update(vi, { targetInvestor: e.target.value })}
            />
          )}

          {v.factorMix !== undefined && (
            <>
              <FieldRow label="Factor Mix">
                <input type="text" value={v.factorMix || ''} onChange={(e) => update(vi, { factorMix: e.target.value })} />
              </FieldRow>
              <FieldRow label="Universe">
                <input type="text" value={v.universe || ''} onChange={(e) => update(vi, { universe: e.target.value })} />
              </FieldRow>
              <FieldRow label="Stock Count">
                <input className="input-sm" type="text" value={v.stockCount || ''} onChange={(e) => update(vi, { stockCount: e.target.value })} />
              </FieldRow>
              <FieldRow label="Reference Index">
                <input type="text" value={v.referenceIndex || ''} onChange={(e) => update(vi, { referenceIndex: e.target.value })} />
              </FieldRow>
              <TextAreaField
                label="Rationale"
                rows={2}
                value={v.rationale || ''}
                onChange={(e) => update(vi, { rationale: e.target.value })}
              />
            </>
          )}

          {v.allocation && (
            <>
              <div className="field-label" style={{ marginBottom: 8 }}>
                Allocation ({v.profile})
              </div>
              <AllocationEditor
                allocations={v.allocation}
                onChange={(allocation) => update(vi, { allocation })}
                addLabel={`+ Add Sleeve to ${v.profile}`}
              />
              {v.expectedEquityLikeExposure !== undefined && (
                <FieldRow label="Equity-like Exposure">
                  <input
                    className="input-sm"
                    type="text"
                    value={v.expectedEquityLikeExposure || ''}
                    onChange={(e) => update(vi, { expectedEquityLikeExposure: e.target.value })}
                  />
                </FieldRow>
              )}
            </>
          )}
        </div>
      ))}
    </>
  )
}
