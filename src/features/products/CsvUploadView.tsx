import { useRef, useState } from 'react'
import Papa from 'papaparse'
import type { ProductRow } from '../../data/types'
import { replaceHoldings } from '../../data/holdings'
import { getErrorMessage } from '../../lib/errors'
import { Button, Callout, SelectField } from '../../design-system'
import './products.css'

export interface CsvUploadViewProps {
  products: ProductRow[]
  onViewProduct: (id: string) => void
}

interface ParsedRow {
  symbol: string
  name: string
  /** Raw string as read from the CSV -- kept for display, matching the frozen app's preview table. */
  weight: string
}

/**
 * CSV Constituent Upload -- ported from the frozen app's renderCsvView()/
 * handleCsvFile() (repo root index.html), same column-normalization logic
 * (symbol/ticker, name/"company name", weight/"weight (%)"/"weight%") and
 * the same total-weight sanity check (flag if the sum is more than 2 points
 * off 100%).
 *
 * Deliberate deviation from the frozen app, disclosed per
 * rebuild/STRATEGY.md: the frozen app stored parsed rows into an in-memory
 * `uploadedConstituents[pid]` map that was never persisted anywhere (see
 * PROJECT_HISTORY.md) -- it existed only for the current tab's Word/Excel
 * exports. Here, parsing and saving are two explicit steps: parse-and-preview
 * happens immediately (as before), but writing into the real
 * `portfolio_holdings` table (via the new `replaceHoldings()` in
 * data/holdings.ts, built this same phase) requires an explicit "Save" click
 * plus a confirm dialog, since it fully replaces that product's existing
 * holdings rather than merging into them -- a real destructive database
 * write deserves an explicit confirmation the old in-memory-only version
 * never needed. React's JSX auto-escapes all interpolated text, so the
 * preview table below gets the same XSS-safety guarantee the frozen app's
 * escText() helper provided by hand (see PROJECT_HISTORY.md's XSS fix
 * entries), with no equivalent helper needed here.
 *
 * Second fix, found by independent review after the above landed:
 * `weightToPct()` silently returned 0 for any weight cell it couldn't parse
 * (blank, "N/A", wrong column entirely) -- harmless in the frozen app since
 * nothing was persisted, but now that a Save writes straight into the real
 * `portfolio_holdings` table, a malformed weight column would have quietly
 * recorded a false 0% for that instrument, catchable only if it threw the
 * aggregate ~100% total off by more than 2 points. `hasValidWeight()` below
 * distinguishes a genuinely unparseable cell from a real, valid "0" (e.g. a
 * legitimately near-zero residual holding) -- only the former blocks Save.
 */
export function CsvUploadView({ products, onViewProduct }: CsvUploadViewProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedProduct = products.find((p) => p.id === productId) ?? null

  // Same normalization as the frozen app's parseFloat-based approx-weight
  // check: treat a value >1 as already a percentage, and a value <=1 as a
  // fraction to be scaled up to a percentage (e.g. "0.125" -> 12.5).
  function weightToPct(raw: string): number {
    const w = parseFloat(raw)
    if (isNaN(w)) return 0
    return w > 1 ? w : w * 100
  }

  // A blank cell, "N/A", or a mis-mapped column all fail this the same way
  // a real "0" does not -- this is the check that keeps a malformed CSV from
  // silently writing a false 0% weight into the real holdings table.
  function hasValidWeight(raw: string): boolean {
    return raw.trim() !== '' && !isNaN(parseFloat(raw))
  }

  const totalWeight = rows.reduce((sum, r) => sum + weightToPct(r.weight), 0)
  const invalidRows = rows.filter((r) => !hasValidWeight(r.weight))

  function handleFile(file: File | null | undefined) {
    if (!file) return
    setParseError(null)
    setSaveError(null)
    setSaved(false)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data
          .map((r) => {
            const keys: Record<string, string> = {}
            Object.keys(r).forEach((k) => {
              keys[k.trim().toLowerCase()] = r[k] ?? ''
            })
            return {
              symbol: keys.symbol || keys.ticker || '',
              name: keys.name || keys['company name'] || '',
              weight: keys.weight || keys['weight (%)'] || keys['weight%'] || '',
            }
          })
          .filter((r) => r.symbol || r.name)
        setRows(parsed)
      },
      error: (err: Error) => {
        setParseError(err.message)
      },
    })
  }

  async function handleSave() {
    if (!selectedProduct || rows.length === 0 || invalidRows.length > 0) return
    if (
      !window.confirm(
        `Save ${rows.length} constituent(s) for ${selectedProduct.data.name}? This replaces any existing holdings currently on record for this product.`,
      )
    )
      return
    setSaving(true)
    setSaveError(null)
    try {
      await replaceHoldings(
        selectedProduct.id,
        rows.map((r) => ({
          instrument_code: r.symbol,
          instrument_name: r.name,
          weight_pct: weightToPct(r.weight),
        })),
      )
      setSaved(true)
    } catch (err) {
      setSaveError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const preview = rows.slice(0, 50)
  const offBy = Math.abs(totalWeight - 100)

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>CSV Constituent Upload</h1>
          <div className="topbar-sub">Attach live constituent/weight data to a product note</div>
        </div>
      </div>
      <Callout>
        Upload a CSV of constituents and weights (columns: <code>symbol, name, weight</code>). Parsed data is
        previewed here, then saved to that product&apos;s portfolio holdings when you click Save.
      </Callout>

      <div className="card">
        <SelectField
          label="Target Product"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value)
            setSaved(false)
          }}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {p.data.name}
            </option>
          ))}
        </SelectField>

        <div
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
        >
          click to choose a csv file, or drag and drop here
          <br />
          <span style={{ fontSize: '.62rem', opacity: 0.7 }}>expected columns: symbol, name, weight</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {parseError && <Callout variant="danger">Parse error: {parseError}</Callout>}

        {rows.length > 0 && (
          <>
            <Callout variant={offBy > 2 ? 'warn' : 'default'}>
              Loaded <strong>{rows.length}</strong> constituents for <strong>{selectedProduct?.data.name}</strong>.
              Approx. total weight: <strong>{totalWeight.toFixed(1)}%</strong>{' '}
              {offBy > 2 ? '— check weights sum to ~100%' : '— OK'}
            </Callout>
            {invalidRows.length > 0 && (
              <Callout variant="danger">
                <strong>{invalidRows.length}</strong> row(s) have a blank or unreadable weight value (highlighted
                below) -- fix the CSV and re-upload before saving. Saving is disabled while these remain, so a bad
                column mapping can't silently record a false 0% for an instrument.
              </Callout>
            )}
            <table>
              <tbody>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Weight</th>
                </tr>
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td>{r.symbol}</td>
                    <td>{r.name}</td>
                    <td style={hasValidWeight(r.weight) ? undefined : { color: 'var(--red)' }}>
                      {r.weight || '(empty)'}
                      {!hasValidWeight(r.weight) && ' ⚠'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <div className="csv-preview-note">Showing first 50 of {rows.length} rows.</div>}

            {saveError && <Callout variant="danger">Save failed: {saveError}</Callout>}
            {saved && <Callout>Saved to {selectedProduct?.data.name}&apos;s portfolio holdings.</Callout>}

            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="primary" disabled={saving || !selectedProduct || invalidRows.length > 0} onClick={handleSave}>
                {saving ? 'Saving…' : invalidRows.length > 0 ? 'Fix invalid weights to save' : 'Save to Portfolio Holdings'}
              </Button>
              {saved && selectedProduct && (
                <Button onClick={() => onViewProduct(selectedProduct.id)}>View Product Note →</Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
