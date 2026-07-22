import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProductRow } from '../../data/types'
import { listProductVersions } from '../../data/products'
import { formatCapsSentence, formatMinMaxRange } from '../../lib/capsFormat'
import { isGoalBased, isRiskVariant, isSingleSleeve, isStrategicAllocation } from '../../lib/archetype'
import { exportProductXlsx } from '../../lib/exportExcel'
import { exportProductDocx } from '../../lib/exportWord'
import { exportClientSummaryPdf, exportProductPdf } from '../../lib/exportPdf'
import { emailNoteVia } from '../../lib/email'
import { DEFAULT_DISCLOSURES_TEXT } from '../../lib/disclosures'
import { Button, Callout, Pill, StatusPill } from '../../design-system'
import './products.css'

export interface ProductDetailProps {
  product: ProductRow
  onEdit: () => void
  onHistory: () => void
  onArchive: () => void
  onUnarchive: () => void
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

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv">
      <div className="k">{label}</div>
      <div className="v">{children}</div>
    </div>
  )
}

/**
 * Read-only product note view. Matches the frozen app's `renderProduct()`
 * (repo root index.html) field-for-field. Export (Word/Excel/PDF) and Email
 * buttons, added in R4, call the async export functions in `lib/` --
 * failures surface as a dismissable-on-retry Callout banner rather than
 * `alert()` (the frozen app's approach), matching the Callout-based error
 * pattern already used by BackupView's download handler.
 */
export function ProductDetail({ product, onEdit, onHistory, onArchive, onUnarchive }: ProductDetailProps) {
  const data = product.data
  const [versionCount, setVersionCount] = useState<number | null>(null)
  const [variantIdx, setVariantIdx] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setVariantIdx(0)
    let cancelled = false
    listProductVersions(product.id).then((v) => {
      if (!cancelled) setVersionCount(v.length)
    })
    return () => {
      cancelled = true
    }
  }, [product.id])

  async function runExport(action: () => Promise<void>) {
    setExportError(null)
    setExporting(true)
    try {
      await action()
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  const variants = isRiskVariant(data) ? data.variants : null
  const instrUniverse = isStrategicAllocation(data)
    ? data.indicativeInstruments
    : isRiskVariant(data)
      ? data.indicativeInstruments || data.sharedInstrumentUniverse
      : undefined

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>{data.name}</h1>
          <div className="topbar-sub">
            {data.category} · Code: {data.code} · <StatusPill kind={product.status}>{product.status}</StatusPill> · v
            {versionCount ?? '…'}
          </div>
        </div>
        <div className="toolbar">
          <Button variant="primary" onClick={onEdit}>
            Edit
          </Button>
          <Button onClick={onHistory}>History &amp; Diff</Button>
          <Button disabled={exporting} onClick={() => runExport(() => exportProductDocx(product))}>
            → Word
          </Button>
          <Button disabled={exporting} onClick={() => runExport(() => exportProductXlsx(product))}>
            → Excel
          </Button>
          <Button disabled={exporting} onClick={() => runExport(() => exportProductPdf(product))}>
            → PDF (Full Note)
          </Button>
          <Button disabled={exporting} onClick={() => runExport(() => exportClientSummaryPdf(product))}>
            → PDF (Client Summary)
          </Button>
          <Button disabled={exporting} onClick={() => runExport(() => emailNoteVia(product, 'gmail'))}>
            ✉ Gmail
          </Button>
          <Button disabled={exporting} onClick={() => runExport(() => emailNoteVia(product, 'outlook'))}>
            ✉ Outlook
          </Button>
          <Button disabled={exporting} onClick={() => runExport(() => emailNoteVia(product, 'yahoo'))}>
            ✉ Yahoo
          </Button>
          <Button disabled={exporting} onClick={() => runExport(() => emailNoteVia(product, 'default'))}>
            ✉ Desktop App
          </Button>
          {product.archived ? (
            <Button onClick={onUnarchive}>Restore from Archive</Button>
          ) : (
            <Button variant="danger" onClick={onArchive}>
              Archive
            </Button>
          )}
        </div>
      </div>

      {exportError && <Callout variant="danger">Export failed: {exportError}</Callout>}

      <div className="card">
        <Kv label="Risk Profile">
          <span className={`risk-badge ${riskClass(data.riskProfile)}`}>{data.riskProfile}</span>
        </Kv>
        <Kv label="Asset Classes">
          {(data.assetClasses || []).map((a, i) => (
            <Pill key={i}>{a}</Pill>
          ))}
        </Kv>
        <Kv label="Benchmark">{data.benchmark}</Kv>
        <Kv label="Rebalance Frequency">{data.rebalanceFrequency}</Kv>
        <Kv label="Min. Investment">{data.minInvestment || '—'}</Kv>
        <Kv label="Fees">{data.fees || '—'}</Kv>
      </div>

      <h2 className="section">Investment Objective</h2>
      <div className="card">
        <p>{data.objective}</p>
      </div>

      <h2 className="section">Philosophy &amp; Methodology</h2>
      <div className="card">
        <p>{data.philosophy || data.selectionMethodology || ''}</p>
        {data.selectionMethodology && data.philosophy && (
          <p style={{ marginTop: 12 }}>
            <strong>Selection Methodology:</strong> {data.selectionMethodology}
          </p>
        )}
        {data.portfolioConstruction && (
          <p style={{ marginTop: 12 }}>
            <strong>Portfolio Construction:</strong> {data.portfolioConstruction}
          </p>
        )}
        {isGoalBased(data) && data.portfolioConstructionNote && (
          <div className="callout">{data.portfolioConstructionNote}</div>
        )}
      </div>

      {isSingleSleeve(data) && (
        <>
          <h2 className="section">Style Sleeves</h2>
          <div className="card">
            <table>
              <tbody>
                <tr>
                  <th>Sleeve</th>
                  <th>Weight Range</th>
                  <th>Criteria</th>
                  <th>Universe</th>
                  <th>Indicative Names</th>
                </tr>
                {data.styleSleeves.map((s, i) => (
                  <tr key={i}>
                    <td>
                      <strong style={{ color: 'var(--mist)' }}>{s.name}</strong>
                    </td>
                    <td>{formatMinMaxRange(s.sleeveMinPct, s.sleeveMaxPct, '%')}</td>
                    <td>{s.criteria}</td>
                    <td>{s.universe}</td>
                    <td>{s.indicativeNames}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="section">Construction Rules</h2>
          <div className="card">
            <Kv label="Stock Count Range">
              {formatMinMaxRange(data.portfolioConstructionRules?.stockCountMin, data.portfolioConstructionRules?.stockCountMax)}
            </Kv>
            <Kv label="Caps & Position Sizing">{formatCapsSentence(data.portfolioConstructionRules)}</Kv>
            <Kv label="Cash Buffer">
              {formatMinMaxRange(data.portfolioConstructionRules?.cashBufferMinPct, data.portfolioConstructionRules?.cashBufferMaxPct, '%')}
            </Kv>
          </div>
        </>
      )}

      {isStrategicAllocation(data) && (
        <>
          <h2 className="section">Strategic Allocation Ranges</h2>
          <div className="card">
            <table>
              <tbody>
                <tr>
                  <th>Sleeve</th>
                  <th>Target Range</th>
                </tr>
                {data.strategicAllocationRanges.map((a, i) => (
                  <tr key={i}>
                    <td>{a.sleeve}</td>
                    <td>{formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {variants && (
        <>
          <h2 className="section">Risk-Profile Variants</h2>
          <div className="card">
            <div className="variant-tabs">
              {variants.map((v, i) => (
                <div key={i} className={`variant-tab ${i === variantIdx ? 'active' : ''}`} onClick={() => setVariantIdx(i)}>
                  {v.profile}
                </div>
              ))}
            </div>
            {variants.map((v, i) =>
              i === variantIdx ? (
                <div key={i}>
                  {v.targetInvestor && (
                    <p style={{ color: 'var(--text-dim)', fontSize: '.82rem', marginBottom: 12 }}>
                      <strong style={{ color: 'var(--pale)' }}>Target investor:</strong> {v.targetInvestor}
                    </p>
                  )}
                  {v.factorMix && (
                    <>
                      <Kv label="Factor Mix">{v.factorMix}</Kv>
                      <Kv label="Universe">{v.universe}</Kv>
                      <Kv label="Stock Count">{v.stockCount}</Kv>
                      <Kv label="Reference Index">{v.referenceIndex}</Kv>
                      <p style={{ marginTop: 12, color: 'var(--text-dim)', fontSize: '.82rem' }}>{v.rationale}</p>
                    </>
                  )}
                  {v.allocation && (
                    <>
                      <table>
                        <tbody>
                          <tr>
                            <th>Sleeve</th>
                            <th>Target Range</th>
                          </tr>
                          {v.allocation.map((a, ai) => (
                            <tr key={ai}>
                              <td>{a.sleeve}</td>
                              <td>{formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {v.expectedEquityLikeExposure && <Kv label="Equity-like Exposure">{v.expectedEquityLikeExposure}</Kv>}
                    </>
                  )}
                </div>
              ) : null,
            )}
          </div>
        </>
      )}

      {isGoalBased(data) && (
        <>
          <h2 className="section">Life Goal Framework (Glide Path)</h2>
          <div className="card">
            {data.goalFramework.map((g, i) => (
              <div key={i} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--canopy)' }}>
                <strong style={{ color: 'var(--mist)' }}>{g.goal}</strong> <span className="pill">{g.horizonBand}</span>
                <p style={{ margin: '10px 0 0', color: 'var(--text-dim)', fontSize: '.82rem' }}>{g.glidePath}</p>
                {g.riskProfileAdjustment && (
                  <p style={{ margin: '8px 0 0', color: 'var(--text-faint)', fontSize: '.76rem' }}>
                    <em>Risk-profile adjustment:</em> {g.riskProfileAdjustment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {instrUniverse && (
        <>
          <h2 className="section">Indicative Instrument Universe</h2>
          <div className="card">
            {Object.keys(instrUniverse).map((k) => (
              <Kv key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}>
                {instrUniverse[k]}
              </Kv>
            ))}
            <div className="callout warn">
              Illustrative universe based on public data as of mid-2026. Reconfirm eligible instruments, tickers, and
              AUM/liquidity thresholds at each rebalance and before launch.
            </div>
          </div>
        </>
      )}

      <h2 className="section">Suitability</h2>
      <div className="card">
        <p>{data.suitability}</p>
      </div>

      <h2 className="section">Key Risks</h2>
      <div className="card">
        <ul className="risk-list">
          {(data.keyRisks || []).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <h2 className="section">Tax &amp; Fees</h2>
      <div className="card">
        <Kv label="Fees">{data.fees || '—'}</Kv>
        <Kv label="Tax Treatment">{data.taxNote || 'To be detailed in a future revision.'}</Kv>
      </div>

      <h2 className="section">Disclosures</h2>
      <div className="card">
        <p style={{ fontSize: '.76rem', color: 'var(--text-faint)' }}>{data.disclosures || DEFAULT_DISCLOSURES_TEXT}</p>
      </div>

      <div className="footer-note">
        Product code {data.code} · Internal product-development document · Status: {product.status.toUpperCase()} ·{' '}
        {versionCount ?? 0} version(s) published · Not investor-facing until reviewed for SEBI compliance
        requirements, final fee structure, and tax disclosures.
      </div>
    </div>
  )
}
