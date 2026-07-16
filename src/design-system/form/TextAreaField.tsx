import type { TextareaHTMLAttributes } from 'react'
import { FieldRow } from './FieldRow'
import './fields.css'

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

/** Wraps a plain `<textarea>` in the standard field-row/field-label layout. */
export function TextAreaField({ label, id, className = '', ...rest }: TextAreaFieldProps) {
  return (
    <FieldRow label={label} htmlFor={id}>
      <textarea id={id} className={className} {...rest} />
    </FieldRow>
  )
}
