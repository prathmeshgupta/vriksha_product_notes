import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

type ButtonVariant = 'default' | 'primary' | 'danger'
type ButtonSize = 'default' | 'small'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

/**
 * Matches the frozen app's `.btn` / `.btn.primary` / `.btn.danger` /
 * `.btn.small` classes exactly (see repo root index.html for source).
 */
export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = ['btn', variant !== 'default' ? variant : '', size === 'small' ? 'small' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
