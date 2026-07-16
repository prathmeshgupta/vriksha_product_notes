import type { HTMLAttributes, ReactNode } from 'react'
import './Callout.css'

type CalloutVariant = 'default' | 'warn' | 'danger'

export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CalloutVariant
  children: ReactNode
}

/**
 * Matches the frozen app's `.callout` / `.callout.warn` / `.callout.danger`
 * classes exactly (see repo root index.html for source).
 */
export function Callout({ variant = 'default', className = '', children, ...rest }: CalloutProps) {
  const classes = ['callout', variant !== 'default' ? variant : '', className].filter(Boolean).join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
