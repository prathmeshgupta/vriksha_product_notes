import type { InputHTMLAttributes } from 'react'
import { FieldRow } from './FieldRow'
import './fields.css'

export interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label: string
  /** null/undefined render as an empty input (matches frozen app's cap-field null handling). */
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  /** Renders as the frozen app's compact `.input-sm` numeric input (used throughout caps editing). */
  compact?: boolean
}

/**
 * Matches the frozen app's numeric cap-input pattern exactly: `min`/`max`/
 * `step` attributes, `.input-sm` sizing, empty-string-for-null, and the
 * "—" placeholder used throughout sleeve/position/sector cap editing (see
 * repo root index.html, e.g. sleeveMinPct/sleeveMaxPct/positionMinPct/
 * positionMaxPct/sectorCapMaxPct fields).
 */
export function NumberField({
  label,
  value,
  onValueChange,
  compact = false,
  id,
  className = '',
  placeholder = '—',
  min = 0,
  max = 100,
  step = 0.1,
  ...rest
}: NumberFieldProps) {
  const classes = [compact ? 'input-sm' : '', className].filter(Boolean).join(' ')

  return (
    <FieldRow label={label} htmlFor={id}>
      <input
        type="number"
        id={id}
        className={classes}
        value={value === null || value === undefined ? '' : value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value
          onValueChange(raw === '' ? null : Number(raw))
        }}
        {...rest}
      />
    </FieldRow>
  )
}
