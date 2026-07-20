import type { MinMaxRange } from '../../../lib/weightSum'
import { weightSumCheck } from '../../../lib/weightSum'
import '../products.css'

export interface WeightSumBadgeProps {
  ranges: MinMaxRange[]
}

/** Matches the frozen app's `weightSumBadge()` (repo root index.html) exactly. */
export function WeightSumBadge({ ranges }: WeightSumBadgeProps) {
  const { lo, hi, ok } = weightSumCheck(ranges)
  return (
    <span className={`weight-sum-badge ${ok ? 'weight-sum-ok' : 'weight-sum-bad'}`}>
      Range sums: low {lo.toFixed(0)}% – high {hi.toFixed(0)}% {ok ? '(plausible)' : '(check — should bracket 100%)'}
    </span>
  )
}
