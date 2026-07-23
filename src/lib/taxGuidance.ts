/**
 * Tax reference module -- generates current, sourced, general tax-character
 * disclosure text for the `taxNote` field.
 *
 * SCOPING NOTE, read before extending this file: the original "Upgrade
 * Roadmap" item this responds to ("Tax module. STCG/LTCG tracking per lot,
 * REIT/InvIT distribution component split, FoF taxation") describes a
 * *client-account-level* tax ledger -- tracking each individual client's
 * actual lots (real purchase price, real purchase date, real quantity) to
 * compute their personal STCG/LTCG liability. This app has never stored
 * that data and has no source for it: `portfolio_holdings` holds a MODEL
 * portfolio's target weights (e.g. "5.00% in RELIANCE"), not any specific
 * client's actual demat/brokerage positions. Building genuine per-client
 * lot-level tax tracking would mean building a client accounting system --
 * a fundamentally different, much larger product requiring broker/demat
 * data feeds this app has no access to, not an incremental feature on the
 * current schema.
 *
 * What IS buildable, and genuinely useful, within the current model-note
 * architecture: accurate, current, general tax-character guidance for the
 * strategy's asset mix, to populate/refresh the note's existing freeform
 * `taxNote` field. This matters because tax rates change (LTCG on listed
 * equity moved from 10% to 12.5% in the July 2024 budget, for example) and
 * a manually-typed note has no way to know it's gone stale. This module is
 * the source of truth for "what does current law actually say", not a
 * per-client tax calculator -- the generated text is a starting point for
 * the person editing the note to review and finalize, not something to
 * publish unreviewed. It is informational, not tax advice, and is not a
 * substitute for the firm's own tax/compliance sign-off.
 *
 * Rates sourced 2026-07-24 (see lib/compliance.ts's disclosure-completeness
 * check for the parallel SEBI-circular sourcing approach):
 * - Listed equity STCG: 20% (holding <=12 months), Section 111A, unchanged
 *   since the 23-Jul-2024 budget.
 * - Listed equity LTCG: 12.5% on gains above Rs 1.25 lakh/FY (holding >12
 *   months), Section 112A, no indexation, unchanged since the same budget.
 * - REIT/InvIT unit capital gains: same STCG/LTCG treatment and rates as
 *   listed equity (Section 112, 20%/12.5%).
 * - REIT/InvIT distributions are NOT capital gains -- they're a mix of
 *   interest, dividend, rental income, and capital repayment, each taxed
 *   differently: interest and dividend distributions are taxed at the
 *   investor's slab rate (with 10% TDS under Section 194LBA); rental
 *   income passed through directly by the trust is exempt in the
 *   unitholder's hands; capital repayment reduces the cost of acquisition
 *   for future capital-gains computation rather than being taxed on
 *   receipt.
 * - Debt-oriented funds / Fund-of-Funds investing >=65% in debt or money
 *   market instruments, for units acquired on or after 1-Apr-2023: always
 *   short-term, taxed at the investor's slab rate regardless of holding
 *   period, no indexation (Section 50AA). Units acquired before 1-Apr-2023
 *   retain the prior regime (LTCG at 12.5% without indexation if held
 *   >24 months).
 */

export interface TaxGuidanceInput {
  /** ProductNoteData.assetClasses -- freeform strings, matched case-insensitively for keywords. */
  assetClasses: string[]
}

const ASOF = 'as of the July 2024 Union Budget and Section 50AA (effective FY 2025-26); confirm no subsequent change before publishing'

function hasKeyword(assetClasses: string[], ...keywords: string[]): boolean {
  const joined = assetClasses.join(' ').toLowerCase()
  return keywords.some((k) => joined.includes(k))
}

/**
 * Builds general tax-character guidance text tailored to what the strategy
 * actually holds (per its declared assetClasses). Always includes the
 * equity capital-gains block, since every archetype in this app holds
 * listed securities; conditionally adds REIT/InvIT and debt/FoF blocks.
 */
export function generateTaxGuidance({ assetClasses }: TaxGuidanceInput): string {
  const blocks: string[] = []

  blocks.push(
    'Capital gains on listed equity holdings: short-term (holding period <= 12 months) taxed at 20% under Section 111A; ' +
      'long-term (holding period > 12 months) taxed at 12.5% on gains above Rs 1.25 lakh per financial year under Section 112A, no indexation.',
  )

  if (hasKeyword(assetClasses, 'reit', 'invit')) {
    blocks.push(
      'REIT/InvIT units: capital gains on sale follow the same listed-security rates above (20% short-term / 12.5% long-term). ' +
        'Distributions are separate from capital gains and are taxed by component: interest and dividend distributions at the ' +
        "investor's slab rate (10% TDS under Section 194LBA); rental income passed through directly by the trust is exempt in " +
        'unitholders\' hands; capital repayment reduces the cost of acquisition for future gains computation rather than being taxed on receipt.',
    )
  }

  if (hasKeyword(assetClasses, 'debt', 'fund of fund', 'fof', 'money market')) {
    blocks.push(
      'Debt-oriented instruments / funds of funds investing 65% or more in debt or money-market instruments: for units acquired ' +
        'on or after 1 April 2023, gains are always treated as short-term and taxed at the applicable slab rate regardless of ' +
        'holding period, with no indexation (Section 50AA). Units acquired before 1 April 2023 retain the prior long-term ' +
        'treatment (12.5% without indexation) if held over 24 months.',
    )
  }

  blocks.push(`Rates ${ASOF}. This is general tax-character information, not individualized tax advice; consult a tax professional for specific situations.`)

  return blocks.join('\n\n')
}
