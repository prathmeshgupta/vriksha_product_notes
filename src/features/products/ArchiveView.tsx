import type { ProductRow } from '../../data/types'
import { Button, Card, CardBody, CardTag, CardTitle } from '../../design-system'
import './products.css'

export interface ArchiveViewProps {
  archivedProducts: ProductRow[]
  onSelect: (id: string) => void
  onRestore: (id: string) => void
}

/** Matches the frozen app's `renderArchiveView()` (repo root index.html) exactly. */
export function ArchiveView({ archivedProducts, onSelect, onRestore }: ArchiveViewProps) {
  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Archived Products</h1>
          <div className="topbar-sub">
            {archivedProducts.length} archived · excluded from main overview and bulk exports · fully recoverable
          </div>
        </div>
      </div>
      <div className="callout">
        Archiving never deletes data — everything here can be restored to the active list at any time. Nothing in
        this studio permanently deletes a product note.
      </div>
      {archivedProducts.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-faint)' }}>No archived products.</p>
        </div>
      ) : (
        <div className="grid-overview">
          {archivedProducts.map((p) => (
            <Card key={p.id} interactive={false}>
              <CardTag>
                {p.id} · {p.code}
              </CardTag>
              <CardTitle>{p.name}</CardTitle>
              <CardBody>{(p.data.objective || '').slice(0, 130)}...</CardBody>
              <div className="toolbar" style={{ marginTop: 10 }}>
                <Button size="small" onClick={() => onSelect(p.id)}>
                  View
                </Button>
                <Button size="small" variant="primary" onClick={() => onRestore(p.id)}>
                  Restore
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
