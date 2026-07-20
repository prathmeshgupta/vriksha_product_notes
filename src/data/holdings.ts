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
