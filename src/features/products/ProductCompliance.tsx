import { useCallback, useEffect, useState } from 'react'
import type { PortfolioHoldingHistoryRow, PortfolioHoldingRow, ProductRow } from '../../data/types'
import { addHolding, deleteHolding, listHoldings, listHoldingsHistory, recordComplianceCheck, updateHolding } from '../../data/holdings'
import { clampPct } from '../../lib/capsFormat'
import { getErrorMessage } from '../../lib/errors'
import { diffHoldings, hasHoldingsChanges, type HoldingsDiffRow } from '../../lib/holdingsDiff'
import { fetchQuote, type QuoteResult } from '../../lib/pricing'
import { downloadRebalanceExportCsv } from '../../lib/rebalanceExport'
import { Button, Callout, StatusPill } from '../../design-system'
import './products.css'

export interface ProductComplianceProps {
  product: ProductRow
  onBackToEdit: () => void
  onAllProducts: () => void
}

const STATUS_LABEL: Record<string, string> = { pass: 'Pass', fail: 'Fail', 'no-data': 'No data', manual: 'Manual' }

/**
 * Which two holdings snapshots to diff. `history` (see below) is ordered
 * most-recent-first (rebalance_number descending), so "the prior rebalance"
 * relative to entry at index i is index i+1, not i-1.
 */
type HoldingsDiffTarget = { kind: 'draft-vs-last' } | { kind: 'history-vs-prior'; idx: number }

/**
 * Renders one diffed instrument row using the same .kv layout and
 * .diff-add/.diff-remove color language VersionHistory.tsx already
 * established for prose diffs -- unchanged instruments are omitted here
 * (summarized as a count by the caller) so the view stays focused on what
 * actually moved, not a full re-listing of the portfolio.
 */
function HoldingsDiffRowView({ row }: { row: HoldingsDiffRow }) {
  return (
    <div className="kv">
      <div className="k">
        {row.instrument_code}
        {row.instrument_name && (
          <div className="topbar-sub" style={{ marginTop: 2, textTransform: 'none' }}>
            {row.instrument_name}
          </div>
        )}
      </div>
      <div className="v">
        {row.status === 'added' && <span className="diff-add">+ added at {row.newWeight?.toFixed(2)}%</span>}
        {row.status === 'removed' && <span className="diff-remove">− removed (was {row.oldWeight?.toFixed(2)}%)</span>}
        {row.status === 'changed' && (
          <>
            <span className="diff-remove">{row.oldWeight?.toFixed(2)}%</span> →{' '}
            <span className="diff-add">{row.newWeight?.toFixed(2)}%</span>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Per-product Compliance screen -- matches the frozen app's
 * `renderProductCompliance()` (repo root index.html) field-for-field: last
 * check result + rule-by-rule detail, editable draft holdings, and full
 * check history. Holdings edits save on blur (not per-keystroke, not
 * debounced) -- simpler than ProductEditor.tsx's debounce infrastructure and
 * closer to the frozen app's literal onchange-per-completed-edit behavior,
 * appropriate here since holdings rows are typically pasted/entered once
 * rather than iterated on like prose fields.
 */
export function ProductCompliance({ product, onBackToEdit, onAllProducts }: ProductComplianceProps) {
  const [holdings, setHoldings] = useState<PortfolioHoldingRow[] | null>(null)
  const [history, setHistory] = useState<PortfolioHoldingHistoryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [diffTarget, setDiffTarget] = useState<HoldingsDiffTarget | null>(null)
  const [quoteSymbol, setQuoteSymbol] = useState('')
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // useCallback (keyed only on product.id, the one thing refresh's body
  // actually reads from outer scope) so this has a stable identity across
  // renders -- lets the effect below list it as a dependency (satisfying
  // react-hooks/exhaustive-deps, which flagged the earlier plain-function
  // version) without re-running on every render the way a plain function
  // redeclared each render would.
  const refresh = useCallback(() => {
    setLoadError(null)
    Promise.all([listHoldings(product.id), listHoldingsHistory(product.id)])
      .then(([h, hist]) => {
        setHoldings(h)
        setHistory(hist)
      })
      .catch((err: unknown) => setLoadError(getErrorMessage(err)))
  }, [product.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const complianceHistory = history.filter((h) => h.event_type === 'compliance_check')
  const lastCheck = complianceHistory[0] ?? null
  const regime = product.regulatory_regime || 'india_sebi'
  const totalWeight = (holdings ?? []).reduce((sum, h) => sum + (Number(h.weight_pct) || 0), 0)

  // Resolve the active diff target (if any) into two labeled snapshots.
  // `history` is most-recent-first, so "prior" relative to index i is i+1.
  let diffLabel: string | null = null
  let diffRows: HoldingsDiffRow[] | null = null
  if (diffTarget?.kind === 'draft-vs-last' && history[0]) {
    const last = history[0]
    diffRows = diffHoldings(last.holdings_snapshot, holdings ?? [])
    diffLabel = `Current Draft vs Rebalance #${last.rebalance_number} (${new Date(last.created_at).toLocaleDateString()})`
  } else if (diffTarget?.kind === 'history-vs-prior') {
    const to = history[diffTarget.idx]
    const from = history[diffTarget.idx + 1]
    if (to && from) {
      diffRows = diffHoldings(from.holdings_snapshot, to.holdings_snapshot)
      diffLabel = `Rebalance #${from.rebalance_number} → #${to.rebalance_number}`
    }
  }

  async function handleCheckCompliance() {
    setCheckError(null)
    setChecking(true)
    try {
      await recordComplianceCheck(product.id, product.data, holdings ?? [])
      refresh()
    } catch (err) {
      setCheckError(getErrorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  async function handleFetchQuote() {
    if (!quoteSymbol.trim()) return
    setQuoteBusy(true)
    setQuoteError(null)
    setQuoteResult(null)
    try {
      setQuoteResult(await fetchQuote(quoteSymbol.trim()))
    } catch (err) {
      setQuoteError(getErrorMessage(err))
    } finally {
      setQuoteBusy(false)
    }
  }

  function patchLocalRow(id: string, fields: Partial<PortfolioHoldingRow>) {
    setHoldings((prev) => (prev ? prev.map((h) => (h.id === id ? { ...h, ...fields } : h)) : prev))
  }

  async function commitRow(id: string, fields: Partial<Pick<PortfolioHoldingRow, 'instrument_code' | 'instrument_name' | 'sleeve' | 'weight_pct' | 'sector'>>) {
    setRowBusy(id)
    try {
      const updated = await updateHolding(id, fields)
      patchLocalRow(id, updated)
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setRowBusy(null)
    }
  }

  async function handleAddHolding() {
    try {
      const created = await addHolding(product.id, { instrument_code: '', instrument_name: '', weight_pct: 0 })
      setHoldings((prev) => (prev ? [...prev, created] : [created]))
    } catch (err) {
      setLoadError(getErrorMessage(err))
    }
  }

  async function handleDeleteHolding(id: string) {
    if (!window.confirm('Remove this holding from the draft?')) return
    try {
      await deleteHolding(id)
      setHoldings((prev) => (prev ? prev.filter((h) => h.id !== id) : prev))
    } catch (err) {
      setLoadError(getErrorMessage(err))
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Compliance — {product.name}</h1>
          <div className="topbar-sub">
            {product.code} · regime: {regime} · {(holdings ?? []).length} holding{(holdings ?? []).length === 1 ? '' : 's'} · total
            weight {totalWeight.toFixed(2)}%
          </div>
        </div>
        <div className="toolbar">
          <Button onClick={onBackToEdit}>← Back to Edit</Button>
          <Button onClick={onAllProducts}>All Products</Button>
          <Button variant="primary" disabled={checking} onClick={handleCheckCompliance}>
            {checking ? 'Checking…' : 'Check Compliance'}
          </Button>
        </div>
      </div>

      {loadError && <Callout variant="danger">{loadError}</Callout>}
      {checkError && <Callout variant="danger">Check failed: {checkError}</Callout>}

      {lastCheck?.compliance_check_result ? (
        <>
          <Callout variant={lastCheck.compliance_check_result.compliant ? 'default' : 'warn'}>
            <strong>{lastCheck.compliance_check_result.compliant ? 'Compliant' : 'Non-Compliant'}</strong> as of last
            check ({new Date(lastCheck.created_at).toLocaleString()}, rebalance #{lastCheck.rebalance_number}).{' '}
            {lastCheck.compliance_check_result.compliant
              ? 'Publish is not blocked.'
              : 'Publish will show an override confirmation until this clears.'}
          </Callout>
          <h2 className="section">Last Check — Rule Detail</h2>
          <div className="card">
            {lastCheck.compliance_check_result.checks.map((c, i) => (
              <div className="kv" style={{ alignItems: 'flex-start' }} key={i}>
                <div className="k">
                  {c.name}{' '}
                  {c.status === 'pass' || c.status === 'fail' ? (
                    <StatusPill kind={c.status === 'pass' ? 'compliant' : 'non-compliant'} showDot>
                      {STATUS_LABEL[c.status] || c.status}
                    </StatusPill>
                  ) : (
                    // Deliberately NOT a StatusPill: the design system only has two pill
                    // colors (green/amber, matching the frozen app -- see StatusPill.css),
                    // and amber is already used for "Fail". Routing "No data"/"Manual"
                    // through the same amber pill would make an unrun/manual-only check
                    // visually indistinguishable from an actual compliance failure -- a
                    // real severity-masking risk on a compliance screen. Plain muted text
                    // keeps it unambiguous without adding an undisclosed third color to a
                    // shared, already-verified component.
                    <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace" }}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  )}
                </div>
                <div className="v">{c.detail}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Callout variant="warn">No compliance check has been run yet for this product. Enter holdings below, then click "Check Compliance."</Callout>
      )}

      <h2 className="section">Live Price Lookup</h2>
      <div className="card">
        <Callout variant="warn">
          Free-tier data feed: roughly 25 lookups per day, account-wide (not per product). Use for occasional spot-checks, not
          automatic/bulk pricing — see the Upgrade Roadmap page for why full live NAV/performance tracking isn't built on this.
        </Callout>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <input
            type="text"
            placeholder="Symbol, e.g. RELIANCE.BSE"
            value={quoteSymbol}
            onChange={(e) => setQuoteSymbol(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchQuote()}
            style={{ maxWidth: 240 }}
          />
          <Button size="small" disabled={quoteBusy || !quoteSymbol.trim()} onClick={handleFetchQuote}>
            {quoteBusy ? 'Fetching…' : 'Fetch Price'}
          </Button>
        </div>
        {quoteError && (
          <div className="topbar-sub" style={{ color: 'var(--red)', marginTop: 10 }}>
            {quoteError}
          </div>
        )}
        {quoteResult && (
          <div className="kv" style={{ marginTop: 10 }}>
            <div className="k">{quoteResult.symbol}</div>
            <div className="v">
              {quoteResult.price != null ? (
                <>
                  ₹{quoteResult.price.toFixed(2)} {quoteResult.changePercent ? `(${quoteResult.changePercent})` : ''}{' '}
                  {quoteResult.latestTradingDay && (
                    <span className="topbar-sub">as of {quoteResult.latestTradingDay}</span>
                  )}
                </>
              ) : (
                <span className="topbar-sub">No price returned — check the symbol format (NSE: .NSE, BSE: .BSE suffix).</span>
              )}
            </div>
          </div>
        )}
      </div>

      <h2 className="section">
        <span>
          Current Draft Holdings <span className="s-label-inline">structured</span>
        </span>
        {history.length > 0 && (
          <Button size="small" onClick={() => setDiffTarget({ kind: 'draft-vs-last' })}>
            Diff vs Last Rebalance
          </Button>
        )}
      </h2>
      <div className="card">
        {(holdings ?? []).map((h) => (
          <div className="editable-table-row five" key={h.id}>
            <input
              type="text"
              value={h.instrument_code}
              placeholder="Code/ISIN"
              disabled={rowBusy === h.id}
              onChange={(e) => patchLocalRow(h.id, { instrument_code: e.target.value })}
              onBlur={(e) => commitRow(h.id, { instrument_code: e.target.value })}
            />
            <input
              type="text"
              value={h.instrument_name}
              placeholder="Instrument name"
              disabled={rowBusy === h.id}
              onChange={(e) => patchLocalRow(h.id, { instrument_name: e.target.value })}
              onBlur={(e) => commitRow(h.id, { instrument_name: e.target.value })}
            />
            <input
              type="text"
              value={h.sector || ''}
              placeholder="Sector"
              disabled={rowBusy === h.id}
              onChange={(e) => patchLocalRow(h.id, { sector: e.target.value })}
              onBlur={(e) => commitRow(h.id, { sector: e.target.value })}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              className="input-sm"
              value={h.weight_pct}
              placeholder="Weight %"
              disabled={rowBusy === h.id}
              onChange={(e) => patchLocalRow(h.id, { weight_pct: clampPct(e.target.value) ?? 0 })}
              onBlur={(e) => commitRow(h.id, { weight_pct: clampPct(e.target.value) ?? 0 })}
            />
            <button className="row-remove" onClick={() => handleDeleteHolding(h.id)}>
              ×
            </button>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <Button size="small" onClick={handleAddHolding}>
            + Add Holding
          </Button>
        </div>
        <div className="topbar-sub" style={{ marginTop: 10 }}>
          Total weight: {totalWeight.toFixed(2)}% {Math.abs(totalWeight - 100) <= 0.5 ? '(within tolerance)' : '(should sum to ~100%)'}
        </div>
      </div>

      {diffRows && diffLabel && (
        <>
          <h2 className="section">
            <span>Diff: {diffLabel}</span>
            {hasHoldingsChanges(diffRows) && (
              <Button size="small" onClick={() => downloadRebalanceExportCsv(diffRows!, product.code, diffLabel!)}>
                Export Rebalance Instructions (CSV)
              </Button>
            )}
          </h2>
          <div className="card">
            {hasHoldingsChanges(diffRows) ? (
              diffRows.filter((r) => r.status !== 'unchanged').map((r) => <HoldingsDiffRowView row={r} key={r.instrument_code} />)
            ) : (
              <span className="diff-unchanged">— no changes —</span>
            )}
            {diffRows.some((r) => r.status === 'unchanged') && (
              <div className="topbar-sub" style={{ marginTop: 10 }}>
                {diffRows.filter((r) => r.status === 'unchanged').length} instrument(s) unchanged, not shown above.
              </div>
            )}
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h2 className="section">Check History</h2>
          <div className="card">
            {history.map((h, i) => (
              <div className="kv" key={h.id}>
                <div className="k">
                  Rebalance #{h.rebalance_number} — {new Date(h.created_at).toLocaleString()}
                </div>
                <div className="v">
                  {h.event_type === 'csv_upload'
                    ? `CSV upload · ${h.holdings_snapshot.length} holding(s) replaced`
                    : `${h.compliance_check_result?.compliant ? 'Compliant' : 'Non-Compliant'} · ${h.holdings_snapshot.length} holding(s)`}
                  {i + 1 < history.length && (
                    <Button size="small" onClick={() => setDiffTarget({ kind: 'history-vs-prior', idx: i })} style={{ marginLeft: 10 }}>
                      Diff vs Prior
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
