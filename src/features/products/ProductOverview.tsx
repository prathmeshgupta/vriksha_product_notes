import type { ProductRow } from '../../data/types'
import { Card, CardBody, CardTag, CardTitle, StatusPill } from '../../design-system'
import './products.css'

export interface ProductOverviewProps {
  products: ProductRow[]
  versionCounts: Map<string, number>
  onSelect: (id: string) => void
}

function riskClass(r: string | undefined): string {
  if (!r) return 'risk-var'
  const s = r.toLowerCase()
  if (s.includes('variant') || s.includes('time-varying')) return 'risk-var'
  if (s.includes('high')) return 'risk-high'
  if (s.includes('moderate') || s.includes('mod')) return 'risk-mod'
  if (s.includes('low')) return 'risk-low'
  return 'risk-var'
}

/**
 * Active-products grid. Matches the frozen app's `renderOverview()` (repo
 * root index.html) field-for-field. "+ New Product" / "Export All" / "Backup"
 * toolbar buttons are R4/R5 territory, not included here yet.
 */
export function ProductOverview({ products, versionCounts, onSelect }: ProductOverviewProps) {
  const publishedCount = products.filter((p) => p.status === 'published').length

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Product Note Studio</h1>
          <div className="topbar-sub">
            {products.length} active products · {publishedCount} published · {products.length - publishedCount} draft
          </div>
        </div>
      </div>
      <div className="callout">
        {products.length} active discretionary &amp; systematic portfolio products, India-focused, smallcase-ready.
        Click a card to view, edit, publish, or export. Amber dot = draft, green dot = published.
      </div>
      <div className="grid-overview">
        {products.map((p) => {
          const isSys = p.category.startsWith('Systematic')
          const versionCount = versionCounts.get(p.id) ?? 0
          return (
            <Card key={p.id} onClick={() => onSelect(p.id)}>
              <CardTag system={isSys}>
                {p.id} · {p.code}
                <span style={{ marginLeft: 'auto' }}>
                  <StatusPill kind={p.status}>{p.status}</StatusPill>
                </span>
              </CardTag>
              <CardTitle>{p.name}</CardTitle>
              <CardBody>{(p.data.objective || '').slice(0, 130)}...</CardBody>
              <div className="meta">
                <span className={`risk-badge ${riskClass(p.data.riskProfile)}`}>{p.data.riskProfile}</span>
                <span>
                  {(p.data.assetClasses || []).length} asset class{(p.data.assetClasses || []).length > 1 ? 'es' : ''}
                </span>
                <span>v{versionCount}</span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
