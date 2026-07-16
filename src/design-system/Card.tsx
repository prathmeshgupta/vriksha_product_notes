import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Set false for a purely-informational card that isn't clickable (no hover affordance). */
  interactive?: boolean
  children: ReactNode
}

/**
 * Matches the frozen app's `.p-card` class exactly (see repo root
 * index.html for source). Use `<Card.Tag>`, `<Card.Title>`, `<Card.Body>`
 * for the standard tag/h3/p layout, or compose children freely.
 */
export function Card({ interactive = true, className = '', children, ...rest }: CardProps) {
  const classes = ['p-card', interactive ? '' : 'static', className].filter(Boolean).join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}

export function CardTag({
  system = false,
  children,
}: {
  system?: boolean
  children: ReactNode
}) {
  return <div className={['tag', system ? 'sys' : ''].filter(Boolean).join(' ')}>{children}</div>
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3>{children}</h3>
}

export function CardBody({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

Card.Tag = CardTag
Card.Title = CardTitle
Card.Body = CardBody
