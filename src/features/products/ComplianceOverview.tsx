import { useEffect, useState } from 'react'
import type { PortfolioHoldingHistoryRow, ProductRow } from '../../data/types'
import { listHoldingsCountByProduct, listLastComplianceCheckByProduct } from '../../data/holdings'
import { getErrorMessage } from '../../lib/errors'
import { Callout, Card, CardBody, CardTag, CardTitle, StatusPill } from '../../design-system'
import './products.css'

export interface ComplianceOverviewProps {
  products: ProductRow[]
  onSelect: (id: string) => void
}

/**
 * Grid of all active products' compliance status -- matches the frozen
 * app's `renderComplianceOverview()` (repo root index.html) field-for-field.
 * Holdings counts and last-check results are fetched in 2 bulk queries
 * rather than per-product, same N+1-avoidance as ProductOverview.tsx's
 * versionCounts.
 */
export function ComplianceOverview({ products, onSelect }: ComplianceOverviewProps) {
  const [holdingsCounts, setHoldingsCounts] = useState<Map<string, number> | null>(null)
  const [lastChecks, setLastChecks] = useState<Map<string, PortfolioHoldingHistoryRow> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listHoldingsCountByProduct(), listLastComplianceCheckByProduct()])
      .then(([counts, checks]) => {
        if (cancelled) return
        setHoldingsCounts(counts)
        setLastChecks(checks)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Compliance</h1>
          <div className="topbar-sub">Holdings, checks, and publish-gating status across all active products</div>
        </div>
      </div>
      <Callout>
        Editing holdings is a draft action — nothing is checked or published automatically. Run "Check Compliance" on
        a product to evaluate its current draft holdings against its regime-appropriate rules. Publish is blocked
        (with an override) only when the last recorded check is Non-Compliant, and only for regimes where the checks
        are binding.
      </Callout>
      {loadError && <Callout variant="danger">Failed to load compliance status: {loadError}</Callout>}
      {(holdingsCounts === null || lastChecks === null) && !loadError && (
        <p style={{ color: 'var(--text-dim)' }}>Loading…</p>
      )}
      {holdingsCounts !== null && lastChecks !== null && (
        <div className="grid-overview">
          {products.map((p) => {
            const holdingsCount = holdingsCounts.get(p.id) ?? 0
            const lastCheck = lastChecks.get(p.id)
            const regime = p.regulatory_regime || 'india_sebi'
            const kind = !lastCheck ? 'draft' : lastCheck.compliance_check_result?.compliant ? 'compliant' : 'non-compliant'
            const label = !lastCheck ? 'Not checked yet' : lastCheck.compliance_check_result?.compliant ? 'Compliant' : 'Non-Compliant'
            return (
              <Card key={p.id} onClick={() => onSelect(p.id)}>
                <CardTag>
                  {p.id} · {p.code}
                  <span style={{ marginLeft: 'auto' }}>
                    <StatusPill kind={kind}>{label}</StatusPill>
                  </span>
                </CardTag>
                <CardTitle>{p.name}</CardTitle>
                <CardBody>
                  {holdingsCount} holding{holdingsCount === 1 ? '' : 's'} entered · regime: {regime}
                </CardBody>
                <div className="meta">
                  <span>{lastCheck ? `Last checked ${new Date(lastCheck.created_at).toLocaleDateString()}` : 'No checks run'}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
