import { useCallback, useEffect, useState } from 'react'
import type { PortfolioHoldingHistoryRow, PortfolioHoldingRow, ProductRow } from '../../data/types'
import { addHolding, deleteHolding, listHoldings, listHoldingsHistory, recordComplianceCheck, updateHolding } from '../../data/holdings'
import { clampPct } from '../../lib/capsFormat'
import { Button, Callout, StatusPill } from '../../design-system'
import './products.css'

export interface ProductComplianceProps {
  product: ProductRow
  onBackToEdit: () => void
  onAllProducts: () => void
}

const STATUS_LABEL: Record<string, string> = { pass: 'Pass', fail: 'Fail', 'no-data': 'No data', manual: 'Manual' }

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
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)))
  }, [product.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const complianceHistory = history.filter((h) => h.event_type === 'compliance_check')
  const lastCheck = complianceHistory[0] ?? null
  const regime = product.regulatory_regime || 'india_sebi'
  const totalWeight = (holdings ?? []).reduce((sum, h) => sum + (Number(h.weight_pct) || 0), 0)

  async function handleCheckCompliance() {
    setCheckError(null)
    setChecking(true)
    try {
      await recordComplianceCheck(product.id, product.data, holdings ?? [])
      refresh()
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : String(err))
    } finally {
      setChecking(false)
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
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setRowBusy(null)
    }
  }

  async function handleAddHolding() {
    try {
      const created = await addHolding(product.id, { instrument_code: '', instrument_name: '', weight_pct: 0 })
      setHoldings((prev) => (prev ? [...prev, created] : [created]))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDeleteHolding(id: string) {
    if (!window.confirm('Remove this holding from the draft?')) return
    try {
      await deleteHolding(id)
      setHoldings((prev) => (prev ? prev.filter((h) => h.id !== id) : prev))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
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
                  <StatusPill kind={c.status === 'pass' ? 'compliant' : c.status === 'fail' ? 'non-compliant' : 'draft'} showDot>
                    {STATUS_LABEL[c.status] || c.status}
                  </StatusPill>
                </div>
                <div className="v">{c.detail}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Callout variant="warn">No compliance check has been run yet for this product. Enter holdings below, then click "Check Compliance."</Callout>
      )}

      <h2 className="section">
        Current Draft Holdings <span className="s-label-inline">structured</span>
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

      {history.length > 0 && (
        <>
          <h2 className="section">Check History</h2>
          <div className="card">
            {history.map((h) => (
              <div className="kv" key={h.id}>
                <div className="k">
                  Rebalance #{h.rebalance_number} — {new Date(h.created_at).toLocaleString()}
                </div>
                <div className="v">
                  {h.event_type === 'csv_upload'
                    ? `CSV upload · ${h.holdings_snapshot.length} holding(s) replaced`
                    : `${h.compliance_check_result?.compliant ? 'Compliant' : 'Non-Compliant'} · ${h.holdings_snapshot.length} holding(s)`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
