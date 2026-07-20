import { Callout } from '../../design-system'
import './products.css'

interface RoadmapItem {
  title: string
  body: string
  done?: boolean
}

/**
 * Static info page, ported from the frozen app's `renderRoadmap()` (repo
 * root index.html). Added in R3 (post-user-testing) as a standalone "R3.5"
 * task -- unlike Compliance/CSV/Create/Templates, this page was never
 * mentioned in any of the 3 rebuild planning docs (STRATEGY.md/ARCHITECTURE.md/
 * ROADMAP.md) as deferred to a later phase, so leaving it out of the nav
 * indefinitely would have been an unplanned gap, not a deliberate deferral.
 *
 * One content change from the frozen app, not a silent one: item 1
 * ("Backend + database") describes moving off localStorage onto a real
 * backend with multi-device sync -- which is exactly what already happened
 * before this rebuild even started (the frozen app itself migrated to
 * Supabase). Marked done here rather than left presented as still-pending,
 * since showing a stale "not done yet" item the app has already shipped
 * would be actively misleading on a page whose whole purpose is an honest
 * status readout.
 */
const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    title: 'Backend + database.',
    body: 'Move product definitions and version history from localStorage into a proper backend (e.g., Postgres) with real multi-device sync — no more manual JSON export/import as the backup discipline.',
    done: true,
  },
  {
    title: 'Live constituent management UI.',
    body: 'Replace CSV-upload-only with an in-dashboard portfolio builder: search instruments, set weights with real-time sum validation, drag-and-drop sleeve rebalancing, diff view against the prior rebalance.',
  },
  {
    title: 'smallcase integration.',
    body: "Direct API push from the dashboard to smallcase's portfolio management endpoints for constituent/weight updates on publish.",
  },
  {
    title: 'Compliance engine.',
    body: 'Automated checks before any rebalance is published: single-stock/sector concentration caps, SEBI disclosure requirements, risk-profile-to-allocation consistency, maker-checker approval workflow.',
  },
  {
    title: 'Live pricing & performance tracking.',
    body: 'Daily prices for all constituents to compute live NAV, drawdown, tracking error vs. benchmark, factor exposure drift.',
  },
  {
    title: 'Tax module.',
    body: 'STCG/LTCG tracking per lot, REIT/InvIT distribution component split, FoF taxation — explicitly out of scope for this version.',
  },
  {
    title: 'Client-facing reporting.',
    body: 'Auto-generated, investor-ready factsheets (distinct from these internal product notes), refreshed on each rebalance.',
  },
]

export function RoadmapView() {
  return (
    <div>
      <div className="topbar">
        <h1>Upgrade Roadmap</h1>
      </div>
      <Callout>
        Product data and version history now live in Supabase (Postgres) with real multi-device sync. Below is the
        intended path to a fuller system beyond that.
      </Callout>
      <div className="card">
        {ROADMAP_ITEMS.map((item, i) => (
          <div className="roadmap-item" key={i}>
            <div className="roadmap-dot" style={item.done ? { background: 'var(--green)' } : undefined} />
            <div style={item.done ? { color: 'var(--text-faint)' } : undefined}>
              <strong style={{ color: item.done ? 'var(--sage)' : 'var(--mist)' }}>
                {item.title} {item.done && '(done)'}
              </strong>{' '}
              {item.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
