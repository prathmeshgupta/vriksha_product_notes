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
    body: 'In-dashboard portfolio builder is live: add/edit/remove holdings with real-time weight-sum validation, plus a diff view against the prior rebalance (or the current unsaved draft) — see the Compliance tab. Still pending: instrument search/autocomplete (codes are typed manually today) and drag-and-drop sleeve rebalancing.',
  },
  {
    title: 'smallcase integration.',
    body: 'A direct, authenticated API push to smallcase needs smallcase\'s own Investment Manager API credentials, which this app has never had. In the meantime, the diff view (Compliance tab) can export a rebalance-instruction CSV — action/instrument/old-and-new-weight — ready to hand to smallcase\'s own bulk tools or a broker/dealer desk. If real API credentials become available, the same diff data is what a live push would send.',
  },
  {
    title: 'Compliance engine.',
    body: 'Live for single-stock/sector concentration caps AND model-portfolio disclosure completeness (methodology, benchmark, rebalance frequency, risk profile, suitability — required by SEBI\'s Jan-2025 model-portfolio circular), with publish gating on a failed check. Still pending: risk-profile-to-allocation consistency checks and a maker-checker approval workflow (needs a user-roles model first).',
  },
  {
    title: 'Live pricing & performance tracking.',
    body: 'On-demand single-symbol price lookup is live (Compliance tab). Full NAV/drawdown/tracking-error/factor-exposure tracking across a whole book is NOT built: the connected data feed is free-tier (~25 lookups/day, account-wide), nowhere near enough for that. Needs a paid data plan or different vendor before the fuller version is realistic.',
  },
  {
    title: 'Tax module.',
    body: "General, current-law tax-character guidance (STCG/LTCG rates, REIT/InvIT distribution treatment) can now be inserted into a product's Tax Note field. True per-client, per-lot STCG/LTCG tracking is NOT built and can't be with this app's current data model — it tracks model-portfolio target weights, not any individual client's actual purchase prices/dates/quantities. That would need a client-account data source this app has never had.",
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
