import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { ProductRow } from '../../data/types'
import { archiveProduct, getProduct, listProducts, listVersionCounts, unarchiveProduct } from '../../data/products'
import { ProductOverview } from './ProductOverview'
import { ProductDetail } from './ProductDetail'
import { ProductEditor } from './ProductEditor'
import { VersionHistory } from './VersionHistory'
import { ArchiveView } from './ArchiveView'
import { RoadmapView } from './RoadmapView'
import { BackupView } from './BackupView'
import { CsvUploadView } from './CsvUploadView'
import { CreateProductView } from './CreateProductView'
import { ManageTemplatesView } from './ManageTemplatesView'
import { Button, Callout } from '../../design-system'
import './products.css'

export interface AppShellProps {
  user: User
  onSignOut: () => void
}

type View = 'overview' | 'product' | 'edit' | 'history' | 'archive' | 'roadmap' | 'backup' | 'csv' | 'create' | 'templates'

const SIDEBAR_COLLAPSE_KEY = 'vriksha_pns_sidebar_collapsed_v1'

/**
 * Top-level app shell: sidebar nav + routed main content. Replaces R2's
 * temporary AuthenticatedPlaceholder. State-based view routing (no router
 * library) matches the frozen app's own `currentView`/`showView()` model
 * (repo root index.html) and rebuild/ARCHITECTURE.md's plan for App.tsx to
 * own "top-level routing/shell" directly.
 */
export function AppShell({ user, onSignOut }: AppShellProps) {
  const [allProducts, setAllProducts] = useState<ProductRow[] | null>(null)
  const [versionCounts, setVersionCounts] = useState<Map<string, number>>(new Map())
  const [view, setView] = useState<View>('overview')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1')
    } catch {
      /* localStorage unavailable -- default to expanded */
    }
  }, [])

  // Returns the fetch promise (not just fire-and-forget) so callers that need
  // to act after fresh data lands -- specifically handleProductCreated below,
  // which must not showEdit(newId) before that id actually exists in
  // allProducts, or the "Product not found" fallback flashes briefly -- can
  // chain onto it instead of racing it.
  function refreshProducts(): Promise<void> {
    setLoadError(null)
    return Promise.all([listProducts({ includeArchived: true }), listVersionCounts()])
      .then(([products, counts]) => {
        setAllProducts(products)
        setVersionCounts(counts)
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(() => {
    refreshProducts()
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const active = useMemo(() => (allProducts ?? []).filter((p) => !p.archived), [allProducts])
  const archived = useMemo(() => (allProducts ?? []).filter((p) => p.archived), [allProducts])
  const current = useMemo(() => (allProducts ?? []).find((p) => p.id === currentId) ?? null, [allProducts, currentId])

  function showOverview() {
    setView('overview')
    setCurrentId(null)
  }
  function showProduct(id: string) {
    setView('product')
    setCurrentId(id)
  }
  function showEdit(id: string) {
    setView('edit')
    setCurrentId(id)
  }
  function showHistory(id: string) {
    setView('history')
    setCurrentId(id)
  }
  function showArchive() {
    setView('archive')
    setCurrentId(null)
  }
  function showRoadmap() {
    setView('roadmap')
    setCurrentId(null)
  }
  function showBackup() {
    setView('backup')
    setCurrentId(null)
  }
  function showCsv() {
    setView('csv')
    setCurrentId(null)
  }
  function showCreate() {
    setView('create')
    setCurrentId(null)
  }
  function showManageTemplates() {
    setView('templates')
    setCurrentId(null)
  }
  function handleProductCreated(id: string) {
    refreshProducts().then(() => showEdit(id))
  }

  async function handleArchive(id: string) {
    if (
      !window.confirm(
        'Archive this product? It will move out of the main overview and bulk exports, but stays fully recoverable from the Archived section.',
      )
    )
      return
    const p = (allProducts ?? []).find((x) => x.id === id)
    if (!p) return
    await archiveProduct(id, p.data, p.status)
    refreshProducts()
    showOverview()
  }

  async function handleUnarchive(id: string) {
    const p = (allProducts ?? []).find((x) => x.id === id)
    if (!p) return
    await unarchiveProduct(id, p.data, p.status)
    refreshProducts()
    showArchive()
  }

  function handleProductRowChanged(updated: ProductRow) {
    setAllProducts((prev) => (prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev))
    // Re-sync from Supabase in the background in case the row's server-side
    // fields (updated_at etc.) drifted from this optimistic local patch.
    getProduct(updated.id)
      .then((fresh) => {
        if (fresh) setAllProducts((prev) => (prev ? prev.map((p) => (p.id === fresh.id ? fresh : p)) : prev))
      })
      .catch(() => {
        /* non-fatal -- optimistic local state stands */
      })
  }

  function toggleGroupCollapsed(title: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  function groupedNav(products: ProductRow[]) {
    const q = search.toLowerCase()
    const filtered = (arr: ProductRow[]) => arr.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    const discretionary = filtered(products.filter((p) => p.category.startsWith('Discretionary')))
    const systematic = filtered(products.filter((p) => p.category.startsWith('Systematic')))
    const other = filtered(
      products.filter((p) => !p.category.startsWith('Discretionary') && !p.category.startsWith('Systematic')),
    )
    return { discretionary, systematic, other }
  }

  const { discretionary, systematic, other } = groupedNav(active)

  function navGroup(title: string, items: ProductRow[]) {
    if (!items.length) return null
    const isCollapsed = collapsedGroups.has(title)
    return (
      <div key={title}>
        <div className="nav-group-title" onClick={() => toggleGroupCollapsed(title)} style={{ cursor: 'pointer' }}>
          <span className="nav-group-toggle">{isCollapsed ? '+' : '−'}</span>
          {title}
        </div>
        {!isCollapsed &&
          items.map((p) => (
            <div
              key={p.id}
              className={`nav-item ${currentId === p.id && view !== 'overview' && view !== 'archive' ? 'active' : ''}`}
              onClick={() => showProduct(p.id)}
            >
              <span>
                {p.short_name || p.name}
                <br />
                <span className="code">
                  {p.code} · {p.id}
                </span>
              </span>
              <span className={`status-dot ${p.status}`} title={p.status} />
            </div>
          ))}
      </div>
    )
  }

  return (
    <div className="app">
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top-row">
          <div className="brand">
            <span className="brand-word">Vriksha</span>
            <span className="brand-tag">notes</span>
          </div>
          <button className="sidebar-toggle" onClick={toggleCollapsed} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>
        <div className="brand-sub">// product note studio</div>

        <div className="user-badge">
          <span>{user.email}</span>
          <button onClick={onSignOut}>Sign out</button>
        </div>

        <input
          className="search-box"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="nav-item" onClick={showOverview}>
          <span>Overview</span>
        </div>
        <div className={`nav-item ${view === 'create' ? 'active' : ''}`} onClick={showCreate}>
          <span>+ New Product</span>
        </div>
        <div className={`nav-item ${view === 'templates' ? 'active' : ''}`} style={{ marginBottom: 8 }} onClick={showManageTemplates}>
          <span>Manage Templates</span>
        </div>

        <div className="nav-list">
          {navGroup('Discretionary', discretionary)}
          {navGroup('Systematic', systematic)}
          {navGroup('Other / Custom', other)}
        </div>

        <div
          className={`nav-item ${view === 'archive' ? 'active' : ''}`}
          style={{ marginTop: 8 }}
          onClick={showArchive}
        >
          <span>Archived Products{archived.length > 0 ? ` (${archived.length})` : ''}</span>
        </div>

        <div
          className={`nav-item ${view === 'backup' ? 'active' : ''}`}
          style={{ marginTop: 16 }}
          onClick={showBackup}
        >
          <span>Backup &amp; Sync</span>
        </div>
        <div className={`nav-item ${view === 'csv' ? 'active' : ''}`} onClick={showCsv}>
          <span>CSV Constituent Upload</span>
        </div>
        <div className={`nav-item ${view === 'roadmap' ? 'active' : ''}`} onClick={showRoadmap}>
          <span>Upgrade Roadmap</span>
        </div>
      </div>

      <div className="main">
        {loadError && <Callout variant="danger">Failed to load products: {loadError}</Callout>}

        {allProducts === null && !loadError && <p style={{ color: 'var(--text-dim)' }}>Loading products…</p>}

        {allProducts !== null && (
          <>
            {view === 'overview' && (
              <ProductOverview products={active} versionCounts={versionCounts} onSelect={showProduct} onCreate={showCreate} />
            )}
            {view === 'archive' && (
              <ArchiveView archivedProducts={archived} onSelect={showProduct} onRestore={handleUnarchive} />
            )}
            {view === 'roadmap' && <RoadmapView />}
            {view === 'backup' && (
              <BackupView products={allProducts ?? []} versionCounts={versionCounts} onRefresh={refreshProducts} />
            )}
            {view === 'csv' && <CsvUploadView products={active} onViewProduct={showProduct} />}
            {view === 'create' && (
              <CreateProductView
                products={active}
                onCreated={handleProductCreated}
                onCancel={showOverview}
                onManageTemplates={showManageTemplates}
              />
            )}
            {view === 'templates' && <ManageTemplatesView />}
            {view === 'product' && current && (
              <ProductDetail
                product={current}
                onEdit={() => showEdit(current.id)}
                onHistory={() => showHistory(current.id)}
                onArchive={() => handleArchive(current.id)}
                onUnarchive={() => handleUnarchive(current.id)}
              />
            )}
            {view === 'edit' && current && (
              <ProductEditor
                product={current}
                onBack={() => showProduct(current.id)}
                onPublished={() => {
                  refreshProducts()
                  showHistory(current.id)
                }}
              />
            )}
            {view === 'history' && current && (
              <VersionHistory
                product={current}
                onBack={() => showProduct(current.id)}
                onChanged={(updated) => {
                  handleProductRowChanged(updated)
                  refreshProducts()
                }}
              />
            )}
            {(view === 'product' || view === 'edit' || view === 'history') && !current && (
              <p style={{ color: 'var(--text-dim)' }}>
                Product not found. <Button onClick={showOverview}>Back to overview</Button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
