import { sb } from '../data/supabaseClient'

/**
 * Client for the `quote-proxy` Supabase Edge Function -- see that function's
 * source (supabase/functions/quote-proxy or the Supabase dashboard) for why
 * this goes through a server-side proxy instead of calling Alpha Vantage
 * directly from the browser (the key would end up in the public JS bundle).
 *
 * Deliberately a single on-demand lookup, not a bulk/portfolio-wide fetch:
 * the connected Alpha Vantage key is free-tier, capped at 25 requests/day,
 * 1/second (confirmed 2026-07-24) -- nowhere near enough to price a whole
 * holdings list on any real cadence. Scoping this to "one symbol, one
 * click" is deliberate, not a missing feature; see rebuild/ROADMAP.md's
 * post-R8 section for the fuller live-pricing/performance-tracking ask this
 * does NOT attempt to solve.
 */
export interface QuoteResult {
  symbol: string
  price: number | null
  changePercent: string | null
  latestTradingDay: string | null
  raw: unknown
}

export async function fetchQuote(symbol: string): Promise<QuoteResult> {
  const { data, error } = await sb.functions.invoke(`quote-proxy?symbol=${encodeURIComponent(symbol)}`, { method: 'GET' })
  if (error) throw error

  // Alpha Vantage's GLOBAL_QUOTE shape: { "Global Quote": { "05. price": "...", "10. change percent": "...", "07. latest trading day": "..." } }
  const quote = (data as Record<string, unknown> | null)?.['Global Quote'] as Record<string, string> | undefined
  const priceRaw = quote?.['05. price']
  return {
    symbol,
    price: priceRaw ? Number(priceRaw) : null,
    changePercent: quote?.['10. change percent'] ?? null,
    latestTradingDay: quote?.['07. latest trading day'] ?? null,
    raw: data,
  }
}
