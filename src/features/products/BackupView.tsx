import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { ProductRow } from '../../data/types'
import { listProductVersions } from '../../data/products'
import { listTemplates } from '../../data/templates'
import { listHoldings, listHoldingsHistory } from '../../data/holdings'
import { sb } from '../../data/supabaseClient'
import { Button, Callout } from '../../design-system'
import './products.css'

export interface BackupViewProps {
  products: ProductRow[]
  versionCounts: Map<string, number>
  onRefresh: () => void
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
 * Status readout + JSON snapshot download, ported from the frozen app's
 * `renderBackupView()`/`downloadSnapshot()` (repo root index.html). Added in
 * R3 (post-user-testing) as a standalone "R3.5" task alongside RoadmapView --
 * see that file's doc comment for why this wasn't just silently dropped.
 *
 * One real improvement over the frozen app's snapshot, not just a port: the
 * frozen app's `state` object (and therefore its JSON export) already
 * included `templates`/`holdings`/`complianceChecks` alongside `products` --
 * this rebuild's R2 data layer (`holdings.ts`, `templates.ts`) already has
 * typed read access to all of that even though the Compliance *screens*
 * themselves are R6 work, so the snapshot here is a genuinely complete
 * backup (every product's full version history + holdings + holdings-check
 * history + every template), not a scaled-down placeholder waiting on R6.
 */
export function BackupView({ products, versionCounts, onRefresh }: BackupViewProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<Date>(new Date())
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [])

  const totalVersions = Array.from(versionCounts.values()).reduce((a, b) => a + b, 0)

  function handleRefresh() {
    onRefresh()
    setLastSynced(new Date())
  }

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    try {
      const [templates, productEntries] = await Promise.all([
        listTemplates(),
        Promise.all(
          products.map(async (p) => {
            const [versions, holdings, holdingsHistory] = await Promise.all([
              listProductVersions(p.id),
              listHoldings(p.id),
              listHoldingsHistory(p.id),
            ])
            return { ...p, versions, holdings, holdingsHistory }
          }),
        ),
      ])
      const snapshot = {
        exportedAt: new Date().toISOString(),
        exportedBy: userEmail,
        products: productEntries,
        templates,
      }
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vriksha_product_notes_snapshot_${ts}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Backup &amp; Sync</h1>
        </div>
        <div className="toolbar">
          <Button onClick={handleRefresh}>↻ Refresh from Database</Button>
        </div>
      </div>
      <Callout>
        Product data and version history live in Supabase (Postgres), shared across everyone signed in to this
        studio — not in this browser&apos;s storage. This screen is a status readout plus an optional local JSON
        export for your own offline backup; it doesn&apos;t control what the app loads from.
      </Callout>
      <div className="card">
        <Kv label="Last Synced (this tab)">{lastSynced.toLocaleString()}</Kv>
        <Kv label="Products">{products.length}</Kv>
        <Kv label="Total Published Versions">{totalVersions}</Kv>
        <Kv label="Signed in as">{userEmail || '—'}</Kv>
        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" disabled={downloading} onClick={handleDownload}>
            {downloading ? 'Preparing…' : 'Download JSON Snapshot (backup copy)'}
          </Button>
        </div>
        {error && <Callout variant="danger">{error}</Callout>}
        <Callout variant="warn">
          This JSON download is a point-in-time export for your own records — it is not a restore mechanism. To
          recover or correct data, edit directly in the studio (writes go straight to Supabase) or ask an
          administrator to intervene at the database level.
        </Callout>
      </div>
    </div>
  )
}
