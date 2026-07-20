import type {
  GoalBasedNote,
  ProductNoteData,
  RiskVariantNote,
  SingleSleeveNote,
  StrategicAllocationNote,
} from '../data/types'

/**
 * Product notes are discriminated by which optional top-level field is
 * present, not by a literal tag on the note itself (only `templates.archetype`
 * carries an explicit tag -- see data/types.ts's `Archetype` type). This
 * matches the frozen app's own approach exactly: `renderEdit()`/`renderProduct()`
 * (repo root index.html) branch on `if(p.styleSleeves)`, `if(p.strategicAllocationRanges)`,
 * `if(p.variants)`, `if(p.goalFramework)` rather than checking a tag field.
 * These type guards centralize that same presence-check so ProductDetail.tsx
 * and ProductEditor.tsx don't each re-implement it.
 */

export function isSingleSleeve(data: ProductNoteData): data is SingleSleeveNote {
  return 'styleSleeves' in data && Array.isArray((data as SingleSleeveNote).styleSleeves)
}

export function isStrategicAllocation(data: ProductNoteData): data is StrategicAllocationNote {
  return 'strategicAllocationRanges' in data && Array.isArray((data as StrategicAllocationNote).strategicAllocationRanges)
}

export function isRiskVariant(data: ProductNoteData): data is RiskVariantNote {
  return 'variants' in data && Array.isArray((data as RiskVariantNote).variants)
}

export function isGoalBased(data: ProductNoteData): data is GoalBasedNote {
  return 'goalFramework' in data && Array.isArray((data as GoalBasedNote).goalFramework)
}
