import type { ReactNode } from 'react'
import './fields.css'

export interface FieldRowProps {
  label: string
  children: ReactNode
  htmlFor?: string
}

/**
 * Matches the frozen app's `.field-row` / `.field-label` two-column layout
 * (label left, input right) used throughout the product note editor.
 */
export function FieldRow({ label, children, htmlFor }: FieldRowProps) {
  return (
    <div className="field-row">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}
