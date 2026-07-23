import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { ProductRow } from '../../data/types'
import { archiveProduct, getProduct, listProducts, listVersionCounts, unarchiveProduct } from '../../data/products'
import { getErrorMessage } from '../../lib/errors'
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
import { ComplianceOverview } from './ComplianceOverview'
import { ProductCompliance } from './ProductCompliance'
import { Button, Callout } from '../../design-system'
import './products.css'

export interface AppShellProps {
  user: User
  onSignOut: () => void
}

type View =
  | 'overview'
  | 'product'
  | 'edit'
  | 'history'
  | 'archive'
  | 'roadmap'
  | 'backup'
  | 'csv'
  | 'create'
  | 'templates'
  | 'compliance'
  | 'productCompliance'

const SIDEBAR_COLLAPSE_KEY = 'vriksha_pns_sidebar_collapsed_v1'

/** How many products a collapsed-then-expanded nav category shows before a "Show all" link takes over. */
const NAV_GROUP_PREVIEW_COUNT = 8

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
  const [loadError, setLoadError] = useState<string | null>(null)
  // Per-category nav collapse state, added after real 9-product usage made
  // clear that an always-expanded flat list won't scale to a real strategy
  // shelf (the frozen app never faced this -- it only ever had 9 products).
  // Categories start collapsed; clicking a header reveals the first
  // NAV_GROUP_PREVIEW_COUNT items plus a "Show all" link for the rest.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showAllGroups, setShowAllGroups] = useState<Set<string>>(new Set())

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
      .catch((err: unknown) => setLoadError(getErrorMessage(err)))
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

  function categoryTitleFor(p: ProductRow): string {
    if (p.category.startsWith('Discretionary')) return 'Discretionary'
    if (p.category.startsWith('Systematic')) return 'Systematic'
    return 'Other / Custom'
  }

  const { discretionary, systematic, other } = useMemo(() => {
    return {
      discretionary: active.filter((p) => p.category.startsWith('Discretionary')),
      systematic: active.filter((p) => p.category.startsWith('Systematic')),
      other: active.filter((p) => !p.category.startsWith('Discretionary') && !p.category.startsWith('Systematic')),
    }
  }, [active])

  // Whichever category the currently-viewed product lives in should always
  // be visible in the nav, even if the user never clicked to expand it --
  // otherwise navigating here (e.g. via search, or straight to Edit from
  // Create) could leave the active item hidden inside a collapsed group
  // with no visible indication of where it is.
  useEffect(() => {
    if (!currentId) return
    const p = active.find((x) => x.id === currentId)
    if (!p) return
    const title = categoryTitleFor(p)
    setExpandedGroups((prev) => (prev.has(title) ? prev : new Set(prev).add(title)))
    const bucket = title === 'Discretionary' ? discretionary : title === 'Systematic' ? systematic : other
    const idx = bucket.findIndex((x) => x.id === currentId)
    if (idx >= NAV_GROUP_PREVIEW_COUNT) {
      setShowAllGroups((prev) => (prev.has(title) ? prev : new Set(prev).add(title)))
    }
  }, [currentId, active, discretionary, systematic, other])

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
  function showCompliance() {
    setView('compliance')
    setCurrentId(null)
  }
  function showProductCompliance(id: string) {
    setView('productCompliance')
    setCurrentId(id)
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

  function toggleGroupExpanded(title: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  /**
   * Collapsible per-category nav group with a preview cap + "Show all" link
   * -- combines two things the user asked for after real usage feedback:
   * (1) categories collapse so a 50+-strategy shelf doesn't dump one giant
   * flat list into the sidebar, (2) clicking a category reveals a short
   * preview (NAV_GROUP_PREVIEW_COUNT) rather than the full list immediately,
   * with an explicit "Show all (N more)" step to see the rest. While the
   * user is actively searching (the search box has text), collapse is
   * bypassed entirely and every match renders regardless of category state
   * or the preview cap -- filtering out a search hit because its category
   * happened to be collapsed would be a much worse experience than a longer
   * list. This is a deliberate departure from the frozen app's own group()
   * helper (repo root index.html ~line 1154), which had no collapse concept
   * at all -- it only ever ran against 9 products and never needed one; see
   * ROADMAP.md for the full reasoning.
   *
   * The category row itself uses the plain `.nav-item` class -- same font,
   * size, weight, and hover/click affordance as Overview/Archived Products
   * right above and below it -- rather than the small-caps monospace
   * `.nav-group-title` style used for the "Products"/"Tools" section
   * labels. A first pass reused `.nav-group-title` here, which put two
   * visibly different typographic systems inside one logical list (plain
   * items vs. label-styled category rows) and layered a dash (from
   * `.nav-group-title::before`) *and* a separate +/− toggle glyph on top of
   * that -- exactly the "mess" the user flagged from a screenshot. The
   * disclosure affordance is now a single chevron (▸/▾), which also reads
   * unambiguously as "expand/collapse" and can't be confused with the
   * literal "+" in "+ New Product" the way a +/− toggle could.
   */
  function navGroup(title: string, items: ProductRow[]) {
    const q = search.trim().toLowerCase()
    const searching = q !== ''
    const filtered = searching ? items.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) : items
    if (!filtered.length) return null

    const isExpanded = searching || expandedGroups.has(title)
    const showAll = searching || showAllGroups.has(title)
    const visibleItems = showAll ? filtered : filtered.slice(0, NAV_GROUP_PREVIEW_COUNT)
    const hiddenCount = filtered.length - visibleItems.length

    return (
      <div key={title}>
        <div
          className="nav-item"
          onClick={searching ? undefined : () => toggleGroupExpanded(title)}
          style={{ cursor: searching ? 'default' : 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="nav-category-toggle">{isExpanded ? '▾' : '▸'}</span>
            {title}
          </span>
          <span className="nav-category-count">{filtered.length}</span>
        </div>
        {isExpanded && (
          <div style={{ paddingLeft: 12 }}>
            {visibleItems.map((p) => (
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
            {!showAll && hiddenCount > 0 && (
              <div
                className="nav-item"
                style={{ color: 'var(--text-faint)' }}
                onClick={() => setShowAllGroups((prev) => new Set(prev).add(title))}
              >
                <span>Show all ({hiddenCount} more) →</span>
              </div>
            )}
          </div>
        )}
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

        {/*
          Two labeled sections, both using the same nav-group-title styling
          (small-caps monospace + the gold dash) so the grouping is visually
          unambiguous, not just implied by DOM order:
          - "Products": everything that navigates the actual product list
            (Overview, +New Product, the collapsible category groups,
            Archived Products) -- these all act on/within the same set of
            product records, so they read as one section.
          - "Tools": screens that aren't about one specific product list
            view (Manage Templates, Compliance, CSV Upload, Backup & Sync,
            Roadmap).
          Reworked from a first pass that literally mirrored the frozen
          app's DOM order (product list, then a "Tools" block that lumped
          Overview/+New Product/Archived Products in with the actual
          utility screens). The frozen app's own grouping was never
          particularly deliberate here (STRATEGY.md §1 -- it grew as one
          inline file with no real information-architecture pass). Real
          user feedback ("shouldn't New Product, Discretionary, Systematic,
          and Archived Products be under the same category?") made the
          right grouping obvious, so this intentionally does NOT match the
          frozen app 1:1 -- flagged per STRATEGY.md's disclosure rule.
        */}
        <div className="nav-group-title">Products</div>
        <div className={`nav-item ${view === 'overview' ? 'active' : ''}`} onClick={showOverview}>
          <span>Overview</span>
        </div>
        <div className={`nav-item ${view === 'create' ? 'active' : ''}`} onClick={showCreate}>
          <span className="nav-item-accent">+ New Product</span>
        </div>

        <div className="nav-list">
          {navGroup('Discretionary', discretionary)}
          {navGroup('Systematic', systematic)}
          {navGroup('Other / Custom', other)}
        </div>

        <div className={`nav-item ${view === 'archive' ? 'active' : ''}`} onClick={showArchive}>
          <span>Archived Products{archived.length > 0 ? ` (${archived.length})` : ''}</span>
        </div>

        <div className="nav-group-title">Tools</div>
        <div className={`nav-item ${view === 'templates' ? 'active' : ''}`} onClick={showManageTemplates}>
          <span>Manage Templates</span>
        </div>
        <div
          className={`nav-item ${view === 'compliance' || view === 'productCompliance' ? 'active' : ''}`}
          onClick={showCompliance}
        >
          <span>Compliance</span>
        </div>
        <div className={`nav-item ${view === 'csv' ? 'active' : ''}`} onClick={showCsv}>
          <span>CSV Constituent Upload</span>
        </div>
        <div className={`nav-item ${view === 'backup' ? 'active' : ''}`} onClick={showBackup}>
          <span>Backup &amp; Sync</span>
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
            {view === 'compliance' && <ComplianceOverview products={active} onSelect={showProductCompliance} />}
            {view === 'productCompliance' && current && (
              <ProductCompliance
                product={current}
                onBackToEdit={() => showEdit(current.id)}
                onAllProducts={showCompliance}
              />
            )}
            {view === 'product' && current && (
              <ProductDetail
                product={current}
                onEdit={() => showEdit(current.id)}
                onHistory={() => showHistory(current.id)}
                onArchive={() => handleArchive(current.id)}
                onUnarchive={() => handleUnarchive(current.id)}
                onCompliance={() => showProductCompliance(current.id)}
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
                onNavigateToCompliance={() => showProductCompliance(current.id)}
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
            {(view === 'product' || view === 'edit' || view === 'history' || view === 'productCompliance') && !current && (
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
