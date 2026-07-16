import type { ReactNode, SelectHTMLAttributes } from 'react'
import { FieldRow } from './FieldRow'
import './fields.css'

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

/** Wraps a plain `<select>` in the standard field-row/field-label layout. */
export function SelectField({ label, id, className = '', children, ...rest }: SelectFieldProps) {
  return (
    <FieldRow label={label} htmlFor={id}>
      <select id={id} className={className} {...rest}>
        {children}
      </select>
    </FieldRow>
  )
}
