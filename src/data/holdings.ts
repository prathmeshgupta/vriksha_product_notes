import { sb } from './supabaseClient'
import type { PortfolioHoldingRow, PortfolioHoldingHistoryRow } from './types'

/**
 * Typed CRUD for `portfolio_holdings` plus read access to
 * `portfolio_holdings_history` (the compliance-check audit log). Matches
 * the frozen app's addHolding/updateHolding/deleteHolding exactly (repo
 * root index.html). The compliance-check *logic* itself (runComplianceCheck,
 * getEffectiveCapThresholds) is R6 territory -- this file only reads/writes
 * the holdings rows, it doesn't evaluate them.
 */

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

export async function listHoldingsHistory(productId: string): Promise<PortfolioHoldingHistoryRow[]> {
  const { data, error } = await sb
    .from('portfolio_holdings_history')
    .select('*')
    .eq('product_id', productId)
    .order('rebalance_number', { ascending: false })
  if (error) throw error
  return (data ?? []) as PortfolioHoldingHistoryRow[]
}

export async function getLastHoldingsCheck(productId: string): Promise<PortfolioHoldingHistoryRow | null> {
  const history = await listHoldingsHistory(productId)
  return history[0] ?? null
}
