import type { ReactNode } from 'react'
import './StatusPill.css'

/**
 * Semantic status kinds the app needs to show. Deliberately maps onto only
 * two underlying visual states ("published" = green, "draft" = amber) --
 * the frozen app's CSS never defines a third color for status pills, and
 * the Compliance screens reuse this same green/amber system rather than
 * inventing a third. See rebuild/ARCHITECTURE.md §2.
 */
export type StatusKind = 'published' | 'draft' | 'compliant' | 'non-compliant'

const KIND_TO_VISUAL: Record<StatusKind, 'published' | 'draft'> = {
  published: 'published',
  draft: 'draft',
  compliant: 'published',
  'non-compliant': 'draft',
}

const DEFAULT_LABEL: Record<StatusKind, string> = {
  published: 'Published',
  draft: 'Draft',
  compliant: 'Compliant',
  'non-compliant': 'Non-Compliant',
}

export interface StatusPillProps {
  kind: StatusKind
  children?: ReactNode
  showDot?: boolean
}

export function StatusPill({ kind, children, showDot = true }: StatusPillProps) {
  const visual = KIND_TO_VISUAL[kind]
  return (
    <span className={`status-pill ${visual}`}>
      {showDot && <span className="dot" />}
      {children ?? DEFAULT_LABEL[kind]}
    </span>
  )
}
