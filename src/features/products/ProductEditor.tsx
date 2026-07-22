import { useEffect, useRef, useState } from 'react'
import type {
  GoalBasedNote,
  ProductNoteData,
  ProductRow,
  RiskVariantNote,
  SingleSleeveNote,
  StrategicAllocationNote,
} from '../../data/types'
import { persistProduct, publishProduct } from '../../data/products'
import { isGoalBased, isRiskVariant, isSingleSleeve, isStrategicAllocation } from '../../lib/archetype'
import { SleeveEditor } from './editors/SleeveEditor'
import { AllocationEditor } from './editors/AllocationEditor'
import { VariantEditor } from './editors/VariantEditor'
import { GoalFrameworkEditor } from './editors/GoalFrameworkEditor'
import { KeyRisksEditor } from './editors/KeyRisksEditor'
import { CapFieldsRow } from './shared/CapFieldsRow'
import { Button, Callout, FieldRow, SelectField, TextAreaField, TextField } from '../../design-system'
import { DEFAULT_DISCLOSURES_TEXT } from '../../lib/disclosures'
import './products.css'

export interface ProductEditorProps {
  product: ProductRow
  onBack: () => void
  onPublished: () => void
}

/**
 * Save-on-blur-equivalent: the frozen app's every editor input uses a plain
 * HTML `onchange` (which for text/textarea/number/select fires once per
 * completed edit, not per keystroke) and persists immediately on each one
 * (see repo root index.html's `updateField`/`saveToLocalStorage` ->
 * `persistProduct`). React's onChange fires per keystroke instead, so
 * persisting on every onChange here would mean a Supabase write per
 * keystroke -- far chattier than the frozen app's actual behavior. This
 * debounces the Supabase write instead of wiring onBlur individually across
 * every field type: local state (and thus the visible UI) still updates
 * immediately on every keystroke, matching "changes apply immediately to
 * your working draft" exactly, but the network write is delayed until
 * typing pauses. This is an implementation-detail choice, not a behavior
 * change -- flagged per rebuild/STRATEGY.md's "no opportunistic redesign"
 * rule since it's a deliberate deviation from a literal per-onchange write.
 */
const SAVE_DEBOUNCE_MS = 800

/**
 * `Partial<ProductNoteData>` does NOT mean "any subset of fields from any
 * archetype" -- `keyof` on a union type only includes fields common to every
 * member, so `Partial<ProductNoteData>` would reject `{ styleSleeves }` etc.
 * outright (a real compile error, not a style nitpick). An intersection of
 * each archetype's own Partial gives the union of all fields, each optional,
 * which is what "patch any field this editor might touch" actually needs.
 */
type NotePatch = Partial<SingleSleeveNote> &
  Partial<StrategicAllocationNote> &
  Partial<RiskVariantNote> &
  Partial<GoalBasedNote>

export function ProductEditor({ product, onBack, onPublished }: ProductEditorProps) {
  const [data, setData] = useState<ProductNoteData>(product.data)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishError, setPublishError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  // Refs so the true-unmount flush effect below (empty deps, runs once) can
  // always reach the *latest* data/product without needing to re-run itself
  // on every keystroke.
  const dataRef = useRef(data)
  dataRef.current = data
  const productMetaRef = useRef({ id: product.id, status: product.status, archived: product.archived })
  productMetaRef.current = { id: product.id, status: product.status, archived: product.archived }
  const hasPendingSave = useRef(false)

  function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (!hasPendingSave.current) return
    hasPendingSave.current = false
    const meta = productMetaRef.current
    persistProduct(meta.id, { data: dataRef.current, status: meta.status, archived: meta.archived })
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'))
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setSaveState('saving')
    hasPendingSave.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
  }, [data])

  /**
   * BUG FIX (found via real user report -- an edit to a product note was
   * "lost," reverting to previously-published content): the debounce above
   * only schedules a write ~800ms after the last keystroke. Navigating away
   * (e.g. "Back to Note") before that timer fires used to just cancel it --
   * silently dropping the edit, never sent to Supabase. This is a *separate*
   * effect with an empty dependency array specifically so its cleanup only
   * runs on true unmount (not on every `data` change like the effect above),
   * and it flushes any pending save immediately instead of cancelling it.
   */
  useEffect(() => {
    return () => {
      flushSave()
    }
  }, [])

  function patch(fields: NotePatch) {
    setData((prev) => ({ ...prev, ...fields }) as ProductNoteData)
  }

  async function handlePublish() {
    const note = window.prompt('Optional note for this version (what changed / why publishing now):', '')
    if (note === null) return // cancelled
    setPublishError(null)
    try {
      await publishProduct(product.id, data, note || '')
      onPublished()
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err))
    }
  }

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : ''

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Edit — {data.name}</h1>
          <div className="topbar-sub">
            {data.code} · unsaved changes apply immediately to the working draft{saveLabel ? ` · ${saveLabel}` : ''}
          </div>
        </div>
        <div className="toolbar">
          <Button onClick={onBack}>← Back to Note</Button>
          <Button onClick={() => patch({ keyRisks: [...(data.keyRisks || []), ''] })}>+ Add Risk</Button>
          <Button variant="primary" onClick={handlePublish}>
            Publish Version
          </Button>
        </div>
      </div>

      {publishError && (
        <Callout variant="danger">Publish failed: {publishError} — no new version was recorded. Your working draft is unchanged; try again.</Callout>
      )}

      <Callout>
        Structured fields (allocation ranges, factor weights, caps) validate as you type. Prose fields (objective,
        philosophy, suitability) are freeform text. Nothing is versioned until you click <strong>Publish Version</strong> —
        until then this is your working draft, saved automatically to Supabase as you edit.
      </Callout>

      <h2 className="section">
        Key Facts <span className="s-label-inline">structured</span>
      </h2>
      <div className="card">
        <TextField label="Risk Profile" value={data.riskProfile} onChange={(e) => patch({ riskProfile: e.target.value })} />
        <TextField label="Benchmark" value={data.benchmark} onChange={(e) => patch({ benchmark: e.target.value })} />
        <TextField
          label="Rebalance Frequency"
          value={data.rebalanceFrequency}
          onChange={(e) => patch({ rebalanceFrequency: e.target.value })}
        />
        <TextField
          label="Min. Investment"
          value={data.minInvestment || ''}
          onChange={(e) => patch({ minInvestment: e.target.value })}
        />
        <TextField label="Fees" value={data.fees || ''} onChange={(e) => patch({ fees: e.target.value })} />
        <TextField label="Tax Note" value={data.taxNote || ''} onChange={(e) => patch({ taxNote: e.target.value })} />
        <SelectField
          label="Regulatory Regime"
          value={data.regulatoryRegime || 'india_sebi'}
          onChange={(e) => patch({ regulatoryRegime: e.target.value as ProductNoteData['regulatoryRegime'] })}
        >
          <option value="india_sebi">India (SEBI)</option>
          <option value="other">Other jurisdiction</option>
          <option value="none">None / not applicable</option>
        </SelectField>
        <div className="topbar-sub" style={{ marginTop: -8, marginBottom: 8 }}>
          Only India (SEBI) runs the full cap/sector/disclosure check set. Other regimes run just the universal
          weights-sum-to-100% check until their own rules are defined.
        </div>
      </div>

      <h2 className="section">
        Objective &amp; Philosophy <span className="s-label-inline">freeform</span>
      </h2>
      <div className="card">
        <TextAreaField label="Objective" rows={3} value={data.objective} onChange={(e) => patch({ objective: e.target.value })} />
        <TextAreaField
          label="Philosophy"
          rows={4}
          value={data.philosophy || ''}
          onChange={(e) => patch({ philosophy: e.target.value })}
        />
        {data.selectionMethodology !== undefined && (
          <TextAreaField
            label="Selection Methodology"
            rows={3}
            value={data.selectionMethodology || ''}
            onChange={(e) => patch({ selectionMethodology: e.target.value })}
          />
        )}
        {data.portfolioConstruction !== undefined && (
          <TextAreaField
            label="Portfolio Construction"
            rows={3}
            value={data.portfolioConstruction || ''}
            onChange={(e) => patch({ portfolioConstruction: e.target.value })}
          />
        )}
        <TextAreaField
          label="Suitability"
          rows={3}
          value={data.suitability || ''}
          onChange={(e) => patch({ suitability: e.target.value })}
        />
      </div>

      {isSingleSleeve(data) && (
        <>
          <h2 className="section">
            Construction Rules — Caps &amp; Limits <span className="s-label-inline">structured, numeric only</span>
          </h2>
          <div className="card">
            <FieldRow label="Stock Count Range">
              <div className="cap-fields-row">
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input-sm"
                  value={data.portfolioConstructionRules?.stockCountMin ?? ''}
                  placeholder="min"
                  onChange={(e) =>
                    patch({
                      portfolioConstructionRules: {
                        ...data.portfolioConstructionRules,
                        stockCountMin: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
                <span>–</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input-sm"
                  value={data.portfolioConstructionRules?.stockCountMax ?? ''}
                  placeholder="max"
                  onChange={(e) =>
                    patch({
                      portfolioConstructionRules: {
                        ...data.portfolioConstructionRules,
                        stockCountMax: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </FieldRow>
            <FieldRow label="Cash Buffer (%)">
              <div className="cap-fields-row">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="input-sm"
                  value={data.portfolioConstructionRules?.cashBufferMinPct ?? ''}
                  placeholder="min %"
                  onChange={(e) =>
                    patch({
                      portfolioConstructionRules: {
                        ...data.portfolioConstructionRules,
                        cashBufferMinPct: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
                <span>–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="input-sm"
                  value={data.portfolioConstructionRules?.cashBufferMaxPct ?? ''}
                  placeholder="max %"
                  onChange={(e) =>
                    patch({
                      portfolioConstructionRules: {
                        ...data.portfolioConstructionRules,
                        cashBufferMaxPct: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </FieldRow>
            <FieldRow label="Sector Cap — Max %">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="input-sm"
                value={data.portfolioConstructionRules?.sectorCapMaxPct ?? ''}
                placeholder="e.g. 30"
                onChange={(e) =>
                  patch({
                    portfolioConstructionRules: {
                      ...data.portfolioConstructionRules,
                      sectorCapMaxPct: e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </FieldRow>
            <div className="field-label" style={{ marginTop: 14, marginBottom: 6 }}>
              Sleeve Allocation &amp; Position-Size Range <span className="s-label-inline">structured, numeric only</span>
            </div>
            <CapFieldsRow
              value={data.portfolioConstructionRules}
              onChange={(capPatch) =>
                patch({ portfolioConstructionRules: { ...data.portfolioConstructionRules, ...capPatch } })
              }
            />
            <Callout>
              These numbers are the single source of truth — the exported note's caps sentence and the compliance
              engine both read directly from these fields. For a single-sleeve product like this one, "Sleeve min/max %"
              describes the whole portfolio's equity exposure band; "Position min/max %" is the per-holding size range.
            </Callout>
          </div>

          <h2 className="section">
            Style Sleeves — Weights <span className="s-label-inline">structured</span>
          </h2>
          <div className="card">
            <SleeveEditor sleeves={data.styleSleeves} onChange={(styleSleeves) => patch({ styleSleeves })} />
          </div>
        </>
      )}

      {isStrategicAllocation(data) && (
        <>
          <h2 className="section">
            Strategic Allocation Ranges <span className="s-label-inline">structured</span>
          </h2>
          <div className="card">
            <AllocationEditor
              allocations={data.strategicAllocationRanges}
              onChange={(strategicAllocationRanges) => patch({ strategicAllocationRanges })}
            />
          </div>
        </>
      )}

      {isRiskVariant(data) && (
        <>
          <h2 className="section">
            Risk-Profile Variants <span className="s-label-inline">structured</span>
          </h2>
          <div className="card">
            <VariantEditor variants={data.variants} onChange={(variants) => patch({ variants })} />
          </div>
        </>
      )}

      {isGoalBased(data) && (
        <>
          <h2 className="section">
            Life Goal Framework <span className="s-label-inline">freeform</span>
          </h2>
          <div className="card">
            <GoalFrameworkEditor goals={data.goalFramework} onChange={(goalFramework) => patch({ goalFramework })} />
          </div>
        </>
      )}

      <h2 className="section">
        Key Risks <span className="s-label-inline">freeform list</span>
      </h2>
      <div className="card">
        <KeyRisksEditor risks={data.keyRisks || []} onChange={(keyRisks) => patch({ keyRisks })} />
      </div>

      <h2 className="section">
        Disclosures <span className="s-label-inline">freeform</span>
      </h2>
      <div className="card">
        <TextAreaField
          label="Disclosures / Disclaimer"
          rows={5}
          value={data.disclosures ?? ''}
          placeholder={DEFAULT_DISCLOSURES_TEXT}
          onChange={(e) => patch({ disclosures: e.target.value })}
        />
        <Callout variant={data.disclosures ? 'default' : 'warn'}>
          {data.disclosures
            ? 'This text renders in the PDF, Word, and read-only exports.'
            : 'Empty — exports currently fall back to a marked DRAFT boilerplate (lib/disclosures.ts), not reviewed compliance text. Fill this in once your firm’s actual disclosure language is finalized.'}
        </Callout>
      </div>

      <div className="footer-note">
        Editing product {data.code}. Changes save automatically to Supabase as you type/blur each field. Nothing is
        versioned or exportable-as-final until you click Publish Version.
      </div>
    </div>
  )
}
