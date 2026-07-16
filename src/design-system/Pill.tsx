import type { HTMLAttributes, ReactNode } from 'react'
import './Pill.css'

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
}

/**
 * Matches the frozen app's `.pill` class exactly (see repo root index.html
 * for source). Generic small tag/chip -- used for things like sector or
 * asset-class labels, not status (see StatusPill for that).
 */
export function Pill({ className = '', children, ...rest }: PillProps) {
  return (
    <span className={['pill', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  )
}
