import { sb } from './supabaseClient'
import type { PortfolioHoldingRow, PortfolioHoldingHistoryRow, ProductNoteData } from './types'
import { runComplianceCheck } from '../lib/compliance'

/**
 * Typed CRUD for `portfolio_holdings` plus read/write access to
 * `portfolio_holdings_history` (the audit log -- covers both compliance-check
 * runs and CSV-upload replace events as of R6, see
 * `holdings_history_event_type_and_csv_upload_audit` migration). Matches
 * the frozen app's addHolding/updateHolding/deleteHolding exactly (repo
 * root index.html). The compliance-check *evaluation* logic itself
 * (runComplianceCheck, getEffectiveCapThresholds) lives in lib/compliance.ts
 * as pure functions with no Supabase dependency -- this file only calls into
 * it and persists the result, it doesn't duplicate the rule logic.
 */

/**
 * One holdings-count per product, in a single query -- backs the Compliance
 * overview grid (all active products) so listing N products' holding counts
 * doesn't fire N separate `listHoldings` calls. Same pattern as
 * data/products.ts's `listVersionCounts()`.
 */
export async function listHoldingsCountByProduct(): Promise<Map<string, number>> {
  const { data, error } = await sb.from('portfolio_holdings').select('product_id')
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const id = row.product_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/**
 * One most-recent-compliance_check row per product, in a single query --
 * same N+1-avoidance reasoning as listHoldingsCountByProduct above. Supabase
 * JS has no `DISTINCT ON`, so this fetches every compliance_check row
 * ordered newest-first and keeps only the first (= most recent) one seen per
 * product_id client-side -- fine at this app's scale (a boutique product
 * shelf, not thousands of rows), same tradeoff `listVersionCounts()` already
 * makes for product_versions.
 */
export async function listLastComplianceCheckByProduct(): Promise<Map<string, PortfolioHoldingHistoryRow>> {
  const { data, error } = await sb
    .from('portfolio_holdings_history')
    .select('*')
    .eq('event_type', 'compliance_check')
    .order('rebalance_number', { ascending: false })
  if (error) throw error
  const map = new Map<string, PortfolioHoldingHistoryRow>()
  for (const row of (data ?? []) as PortfolioHoldingHistoryRow[]) {
    if (!map.has(row.product_id)) map.set(row.product_id, row)
  }
  return map
}

export async function listHoldings(productId: string): Promise<PortfolioHoldingRow[]> {
  const { data, error } = await sb
    .from('portfolio_holdings')
    .select('*')
    .eq('product_id', productId)
    .order('instrument_code')
  if (error) throw error
  return (data ?? []) as PortfolioHoldingRow[]
}

export async function addHolding(
  productId: string,
  holding: {
    instrument_code: string
    instrument_name: string
    sleeve?: string | null
    weight_pct: number
    sector?: string | null
  },
): Promise<PortfolioHoldingRow> {
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { data, error } = await sb
    .from('portfolio_holdings')
    .insert({
      product_id: productId,
      instrument_code: holding.instrument_code,
      instrument_name: holding.instrument_name,
      sleeve: holding.sleeve || null,
      weight_pct: holding.weight_pct,
      sector: holding.sector || null,
      updated_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as PortfolioHoldingRow
}

export async function updateHolding(
  holdingId: string,
  fields: Partial<Pick<PortfolioHoldingRow, 'instrument_code' | 'instrument_name' | 'sleeve' | 'weight_pct' | 'sector'>>,
): Promise<PortfolioHoldingRow> {
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { data, error } = await sb
    .from('portfolio_holdings')
    .update({ ...fields, updated_by: user?.id ?? null })
    .eq('id', holdingId)
    .select()
    .single()
  if (error) throw error
  return data as PortfolioHoldingRow
}

export async function deleteHolding(holdingId: string): Promise<void> {
  const { error } = await sb.from('portfolio_holdings').delete().eq('id', holdingId)
  if (error) throw error
}

/**
 * Bulk-replace every holding for a product in one operation -- backs the R4
 * CSV Constituent Upload screen. Deliberate deviation from the frozen app:
 * the frozen app's CSV upload (`handleCsvFile`, repo root index.html) only
 * ever wrote into an in-memory `uploadedConstituents[pid]` map, explicitly
 * ephemeral and never persisted (see PROJECT_HISTORY.md). The rebuild
 * already has a real `portfolio_holdings` table and full CRUD (this file,
 * built in R2), so keeping CSV upload ephemeral here would just be building
 * throwaway state -- especially since R6's Compliance Engine needs real
 * holdings data to check against. Flagged per STRATEGY.md's "disclose
 * deliberate deviations" rule; see rebuild/ROADMAP.md R4.
 *
 * Semantics: delete-then-insert (not a diff/merge) -- a fresh CSV upload is
 * meant to fully replace the current constituent list, matching how the
 * frozen app's preview/replace UX read to the user even though it never
 * actually persisted before.
 *
 * Implemented via the `replace_portfolio_holdings` Postgres function
 * (migration `replace_portfolio_holdings_rpc`, applied 2026-07-20) rather
 * than two separate client calls. The first version of this function did a
 * plain `.delete()` then `.insert()` from the client with no transaction
 * tying them together -- if the insert failed after the delete succeeded
 * (bad row data, a dropped connection), the product was left with zero
 * holdings instead of its prior ones. Verified against a real constraint
 * violation (weight_pct outside 0-100) during testing: the RPC's delete and
 * insert now roll back together, so a rejected upload leaves the product's
 * existing holdings untouched. The function runs `security invoker`, so
 * it's still governed by portfolio_holdings' existing RLS policies (any
 * authenticated user, full read/write, no maker-checker) -- this does not
 * escalate privileges beyond what the two separate client calls already had.
 */
export async function replaceHoldings(
  productId: string,
  rows: Array<{
    instrument_code: string
    instrument_name: string
    sleeve?: string | null
    weight_pct: number
    sector?: string | null
  }>,
): Promise<PortfolioHoldingRow[]> {
  const { data, error } = await sb.rpc('replace_portfolio_holdings', {
    p_product_id: productId,
    p_rows: rows.map((r) => ({
      instrument_code: r.instrument_code,
      instrument_name: r.instrument_name,
      sleeve: r.sleeve || null,
      weight_pct: r.weight_pct,
      sector: r.sector || null,
    })),
  })
  if (error) throw error
  return (data ?? []) as PortfolioHoldingRow[]
}

/** Full unified audit trail -- both compliance_check and csv_upload events, most recent first. */
export async function listHoldingsHistory(productId: string): Promise<PortfolioHoldingHistoryRow[]> {
  const { data, error } = await sb
    .from('portfolio_holdings_history')
    .select('*')
    .eq('product_id', productId)
    .order('rebalance_number', { ascending: false })
  if (error) throw error
  return (data ?? []) as PortfolioHoldingHistoryRow[]
}

/**
 * The most recent *compliance_check* event specifically -- deliberately
 * filtered by event_type, not just "the most recent history row of any
 * kind." A csv_upload row has `compliance_check_result: null`; if this
 * function returned whichever event happened most recently regardless of
 * type, a CSV upload made after the last real check would make this return
 * a null-result row, and the publish-gate logic in ProductEditor.tsx (which
 * reads `lastCheck.compliance_check_result.compliant`) would break or
 * silently treat "nobody has re-checked since the CSV changed the holdings"
 * as "no check has ever been run." Filtering server-side also means this
 * never has to fetch/scan the full history just to find one row.
 */
export async function getLastHoldingsCheck(productId: string): Promise<PortfolioHoldingHistoryRow | null> {
  const { data, error } = await sb
    .from('portfolio_holdings_history')
    .select('*')
    .eq('product_id', productId)
    .eq('event_type', 'compliance_check')
    .order('rebalance_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as PortfolioHoldingHistoryRow | null
}

/**
 * Runs the compliance engine (lib/compliance.ts) against a product's current
 * draft holdings and persists the result as a new portfolio_holdings_history
 * row (event_type='compliance_check'). rebalance_number is a single counter
 * shared with csv_upload events for the same product (see the R6 migration's
 * comment) -- computed here as max-existing+1 rather than left to a DB
 * default, matching the frozen app's recordComplianceCheck()'s own approach
 * (repo root index.html) of computing it in application code.
 */
export async function recordComplianceCheck(
  productId: string,
  product: ProductNoteData,
  holdings: PortfolioHoldingRow[],
): Promise<PortfolioHoldingHistoryRow> {
  const result = runComplianceCheck(product, holdings)

  const history = await listHoldingsHistory(productId)
  const nextRebalanceNumber = history.length ? Math.max(...history.map((h) => h.rebalance_number)) + 1 : 1

  const {
    data: { user },
  } = await sb.auth.getUser()

  const { data, error } = await sb
    .from('portfolio_holdings_history')
    .insert({
      product_id: productId,
      rebalance_number: nextRebalanceNumber,
      holdings_snapshot: holdings,
      compliance_check_result: result,
      event_type: 'compliance_check',
      created_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as PortfolioHoldingHistoryRow
}
