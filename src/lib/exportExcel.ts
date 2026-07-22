import * as XLSX from 'xlsx'
import type { ProductRow, ProductVersionRow } from '../data/types'
import { listProductVersions } from '../data/products'
import { listHoldings } from '../data/holdings'
import { formatCapsSentence, formatMinMaxRange } from './capsFormat'
import { isGoalBased, isRiskVariant, isSingleSleeve, isStrategicAllocation } from './archetype'

/**
 * Excel export -- ported from the frozen app's exportXlsx/exportAllXlsx/
 * productToRows (repo root index.html), field-name-adapted for the
 * rebuild's structured numeric cap fields (data/types.ts's CapRange etc.)
 * in place of the frozen app's free-text weightRange/range/stockCountRange/
 * cashBuffer strings -- same adaptation already made in ProductDetail.tsx's
 * read-only view (formatMinMaxRange/formatCapsSentence).
 *
 * Structural difference from the frozen app (disclosed, not silent): the
 * frozen app read everything (versions, uploadedConstituents) from
 * in-memory state synchronously. Here, product_versions and
 * portfolio_holdings are fetched from Supabase, so both exports below are
 * async and the caller must await them before/instead of relying on a
 * synchronous file-save.
 *
 * A second small, deliberate deviation: exportAllProductsXlsx's filename
 * uses the live product count (`Vriksha_Product_Notes_All${n}.xlsx`) rather
 * than the frozen app's hardcoded `_All9` -- hardcoding "9" would silently
 * go stale the moment R5's create-product flow adds a 10th product.
 */

function productToRows(product: ProductRow, versions: ProductVersionRow[]): string[][] {
  const p = product.data
  const rows: string[][] = []
  rows.push(['Field', 'Value'])
  rows.push(['Product ID', product.id])
  rows.push(['Code', p.code])
  rows.push(['Name', p.name])
  rows.push(['Status', product.status])
  rows.push(['Version', 'v' + versions.length + (product.status === 'draft' ? ' (+ unpublished draft edits)' : '')])
  rows.push(['Category', p.category])
  rows.push(['Asset Classes', (p.assetClasses || []).join('; ')])
  rows.push(['Objective', p.objective])
  rows.push(['Philosophy/Methodology', p.philosophy || p.selectionMethodology || ''])
  rows.push(['Benchmark', p.benchmark])
  rows.push(['Rebalance Frequency', p.rebalanceFrequency])
  rows.push(['Risk Profile', p.riskProfile])
  rows.push(['Suitability', p.suitability])
  rows.push(['Min Investment', p.minInvestment || ''])
  rows.push(['Fees', p.fees || ''])
  rows.push(['Tax Note', p.taxNote || ''])
  rows.push(['Key Risks', (p.keyRisks || []).join(' | ')])
  if (isSingleSleeve(p)) {
    const r = p.portfolioConstructionRules
    rows.push(['Stock Count Range', formatMinMaxRange(r?.stockCountMin, r?.stockCountMax)])
    rows.push(['Caps & Position Sizing', formatCapsSentence(r)])
    rows.push(['Cash Buffer', formatMinMaxRange(r?.cashBufferMinPct, r?.cashBufferMaxPct, '%')])
  }
  return rows
}

/** Single-product multi-sheet workbook, matching the frozen app's exportXlsx(pid). */
export async function exportProductXlsx(product: ProductRow): Promise<void> {
  const p = product.data
  const [versions, holdings] = await Promise.all([listProductVersions(product.id), listHoldings(product.id)])

  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.aoa_to_sheet(productToRows(product, versions))
  ws1['!cols'] = [{ wch: 24 }, { wch: 100 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Product Note')

  if (isSingleSleeve(p)) {
    const rows: string[][] = [['Sleeve', 'Weight Range', 'Criteria', 'Universe', 'Indicative Names']]
    p.styleSleeves.forEach((s) =>
      rows.push([s.name, formatMinMaxRange(s.sleeveMinPct, s.sleeveMaxPct, '%'), s.criteria, s.universe, s.indicativeNames]),
    )
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 60 }, { wch: 40 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Style Sleeves')
  }

  if (isStrategicAllocation(p)) {
    const rows: string[][] = [['Sleeve', 'Target Range']]
    p.strategicAllocationRanges.forEach((a) => rows.push([a.sleeve, formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')]))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 60 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Allocation Ranges')
  }

  if (isRiskVariant(p)) {
    const rows: string[][] = [['Variant', 'Sleeve', 'Target Range']]
    p.variants.forEach((v) => {
      if (v.allocation) v.allocation.forEach((a) => rows.push([v.profile, a.sleeve, formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')]))
      else rows.push([v.profile, v.factorMix || '', v.universe || ''])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 55 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Risk Variants')
  }

  if (isGoalBased(p)) {
    const rows: string[][] = [['Goal', 'Horizon Band', 'Glide Path']]
    p.goalFramework.forEach((g) => rows.push([g.goal, g.horizonBand, g.glidePath]))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 90 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Goal Framework')
  }

  const instr = isStrategicAllocation(p)
    ? p.indicativeInstruments
    : isRiskVariant(p)
      ? p.indicativeInstruments || p.sharedInstrumentUniverse
      : undefined
  if (instr) {
    const rows: string[][] = [['Sleeve', 'Instruments']]
    Object.keys(instr).forEach((k) => rows.push([k, instr[k] ?? '']))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 100 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Instrument Universe')
  }

  if (versions.length) {
    const rows: string[][] = [['Version', 'Timestamp', 'Note']]
    versions.forEach((v) => rows.push(['v' + v.version_number, v.created_at, v.note || '']))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 80 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Version History')
  }

  if (holdings.length) {
    const rows: string[][] = [['Symbol', 'Name', 'Weight']]
    holdings.forEach((h) => rows.push([h.instrument_code, h.instrument_name, String(h.weight_pct)]))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Constituents')
  }

  XLSX.writeFile(wb, `${p.code}_${product.id}_ProductNote.xlsx`)
}

/** All-products summary + one sheet per product, matching the frozen app's exportAllXlsx(). */
export async function exportAllProductsXlsx(products: ProductRow[]): Promise<void> {
  const wb = XLSX.utils.book_new()
  const withVersions = await Promise.all(
    products.map(async (product) => ({ product, versions: await listProductVersions(product.id) })),
  )

  const summaryRows: string[][] = [
    ['ID', 'Code', 'Name', 'Category', 'Status', 'Version', 'Risk Profile', 'Benchmark', 'Rebalance Frequency'],
  ]
  withVersions.forEach(({ product, versions }) => {
    const p = product.data
    summaryRows.push([
      product.id,
      p.code,
      p.name,
      p.category,
      product.status,
      'v' + versions.length,
      p.riskProfile,
      p.benchmark,
      p.rebalanceFrequency,
    ])
  })
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 55 }, { wch: 35 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 50 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'All Products Summary')

  withVersions.forEach(({ product, versions }) => {
    const ws = XLSX.utils.aoa_to_sheet(productToRows(product, versions))
    ws['!cols'] = [{ wch: 24 }, { wch: 100 }]
    XLSX.utils.book_append_sheet(wb, ws, product.data.code.slice(0, 28))
  })

  XLSX.writeFile(wb, `Vriksha_Product_Notes_All${products.length}.xlsx`)
}
