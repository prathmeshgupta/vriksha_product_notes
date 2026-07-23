import { useEffect, useState } from 'react'
import type { ProductNoteData, ProductRow, ProductVersionRow } from '../../data/types'
import { listProductVersions, persistProduct, unpublishToDraft } from '../../data/products'
import { DIFF_FIELDS, diffText, fieldValueAt } from '../../lib/diff'
import { getErrorMessage } from '../../lib/errors'
import { Button, Callout } from '../../design-system'
import './products.css'

export interface VersionHistoryProps {
  product: ProductRow
  onBack: () => void
  /** Called after a successful unpublish or revert -- caller should refresh product state. */
  onChanged: (updated: ProductRow) => void
}

type DiffTarget = { fromIdx: number; toIdx: number | 'current' }

function DiffRow({ label, a, b }: { label: string; a: string; b: string }) {
  if (a === b) return null
  const tokens = diffText(a, b)
  return (
    <div className="diff-field">
      <div className="df-label">{label}</div>
      <div>
        {tokens.map((t, i) =>
          t.t === 'same' ? (
            <span key={i}>{t.v}</span>
          ) : t.t === 'del' ? (
            <span key={i} className="diff-remove">
              {t.v}
            </span>
          ) : (
            <span key={i} className="diff-add">
              {t.v}
            </span>
          ),
        )}
      </div>
    </div>
  )
}

/**
 * Version history + diff view. Matches the frozen app's `renderHistory()` /
 * `showDiff()` / `renderDiffHtml()` (repo root index.html) -- same
 * DIFF_FIELDS list, same word-level diff, same revert/unpublish actions.
 *
 * `tsconfig.app.json`'s `noUncheckedIndexedAccess` means every `versions[i]`
 * is typed `ProductVersionRow | undefined`, even where the index is known
 * good by construction (came from `.indexOf()` on the same array, or was
 * captured at click-time from a valid row). Rather than assert past that
 * everywhere, this version resolves each index to a real row once, with an
 * explicit "can't happen, but degrade safely rather than crash" bail-out.
 */
export function VersionHistory({ product, onBack, onChanged }: VersionHistoryProps) {
  const [versions, setVersions] = useState<ProductVersionRow[] | null>(null)
  const [diffTarget, setDiffTarget] = useState<DiffTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listProductVersions(product.id).then((v) => {
      if (!cancelled) setVersions(v)
    })
    return () => {
      cancelled = true
    }
  }, [product.id])

  async function handleUnpublish() {
    setBusy(true)
    setError(null)
    try {
      await unpublishToDraft(product.id, product.data)
      onChanged({ ...product, status: 'draft' })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRevert(versionIdx: number) {
    if (!versions) return
    const v = versions[versionIdx]
    if (!v) return
    if (
      !window.confirm(
        `Revert working draft to v${v.version_number} (published ${new Date(v.created_at).toLocaleString()})? This overwrites your current unsaved edits.`,
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      const revertedData = JSON.parse(JSON.stringify(v.data)) as ProductNoteData
      await persistProduct(product.id, { data: revertedData, status: 'draft', archived: product.archived })
      onChanged({ ...product, data: revertedData, status: 'draft' })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (versions === null) {
    return <p style={{ color: 'var(--text-dim)' }}>Loading version history…</p>
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Version History — {product.name}</h1>
          <div className="topbar-sub">
            {versions.length} published version(s) · current status: <strong>{product.status}</strong>
          </div>
        </div>
        <div className="toolbar">
          <Button onClick={onBack}>← Back to Note</Button>
          {product.status === 'published' && (
            <Button disabled={busy} onClick={handleUnpublish}>
              Mark as Draft
            </Button>
          )}
        </div>
      </div>

      {error && <Callout variant="danger">{error}</Callout>}

      {versions.length === 0 ? (
        <Callout variant="warn">
          No published versions yet. The current content is an unpublished working draft — publish it from the Edit
          screen to create v1 and start the audit trail.
        </Callout>
      ) : (
        <>
          <h2 className="section">Published Versions</h2>
          <div className="card">
            {versions
              .slice()
              .reverse()
              .map((v) => {
                const idx = versions.indexOf(v)
                const prev = idx > 0 ? versions[idx - 1] : undefined
                return (
                  <div className="version-row" key={v.id}>
                    <div>
                      <div className="vmeta">
                        v{v.version_number} {v.note ? `— ${v.note}` : ''}
                      </div>
                      <div className="vtime">{new Date(v.created_at).toLocaleString()}</div>
                    </div>
                    <div className="toolbar">
                      {prev && (
                        <Button size="small" onClick={() => setDiffTarget({ fromIdx: idx - 1, toIdx: idx })}>
                          Diff vs v{prev.version_number}
                        </Button>
                      )}
                      <Button size="small" onClick={() => setDiffTarget({ fromIdx: idx, toIdx: 'current' })}>
                        Diff vs Draft
                      </Button>
                      <Button size="small" disabled={busy} onClick={() => handleRevert(idx)}>
                        Revert Draft to This
                      </Button>
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {diffTarget &&
        (() => {
          const fromVersion = versions[diffTarget.fromIdx]
          const toVersion = diffTarget.toIdx === 'current' ? undefined : versions[diffTarget.toIdx]
          if (!fromVersion) return null
          if (diffTarget.toIdx !== 'current' && !toVersion) return null

          const toDataValue = diffTarget.toIdx === 'current' ? product.data : (toVersion as ProductVersionRow).data
          const toLabel = diffTarget.toIdx === 'current' ? 'Current Draft' : `v${(toVersion as ProductVersionRow).version_number}`

          const fromData = fromVersion.data as unknown as Record<string, unknown>
          const toDataObj = toDataValue as unknown as Record<string, unknown>
          const rows = DIFF_FIELDS.map((f) => ({
            field: f,
            a: fieldValueAt(fromData, f),
            b: fieldValueAt(toDataObj, f),
          }))
          const anyChange = rows.some((r) => r.a !== r.b)

          return (
            <div>
              <h2 className="section">
                Diff: v{fromVersion.version_number} → {toLabel}
              </h2>
              <div className="card">
                {!anyChange && <span className="diff-unchanged">— no changes in the compared fields —</span>}
                {rows.map((r) => (
                  <DiffRow key={r.field} label={r.field} a={r.a} b={r.b} />
                ))}
              </div>
            </div>
          )
        })()}
    </div>
  )
}
