import type { InputHTMLAttributes } from 'react'
import { FieldRow } from './FieldRow'
import './fields.css'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

/** Wraps a plain text `<input>` in the standard field-row/field-label layout. */
export function TextField({ label, id, className = '', ...rest }: TextFieldProps) {
  return (
    <FieldRow label={label} htmlFor={id}>
      <input type="text" id={id} className={className} {...rest} />
    </FieldRow>
  )
}
