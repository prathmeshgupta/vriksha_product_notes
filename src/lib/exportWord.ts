import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { saveAs } from 'file-saver'
import type { ProductRow } from '../data/types'
import { listProductVersions } from '../data/products'
import { listHoldings } from '../data/holdings'
import { formatCapsSentence, formatMinMaxRange } from './capsFormat'
import { isGoalBased, isRiskVariant, isSingleSleeve, isStrategicAllocation } from './archetype'
import { DEFAULT_DISCLOSURES_TEXT } from './disclosures'

/**
 * Word export -- ported from the frozen app's exportDocx (repo root
 * index.html), field-name-adapted the same way exportExcel.ts was: numeric
 * min/max cap fields via formatMinMaxRange/formatCapsSentence in place of
 * the frozen app's free-text weightRange/range/stockCountRange/cashBuffer,
 * and archetype-scoped fields (portfolioConstructionNote) gated behind the
 * matching type guard instead of an untyped `if(p.field)` check. Same async
 * structural difference as exportExcel.ts: versions and holdings are
 * fetched from Supabase rather than read from in-memory state.
 */

function h2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 } })
}

function body(text: string | undefined | null): Paragraph {
  return new Paragraph({ children: [new TextRun(text || '—')], spacing: { after: 160 } })
}

function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60 } })
}

function kvPara(k: string, v: string | undefined | null): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: k + ': ', bold: true }), new TextRun(v || '—')],
    spacing: { after: 80 },
  })
}

function simpleTable(headerRow: string[], dataRows: (string | number)[][]): Table {
  const mkCell = (text: string | number, bold: boolean) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold })] })],
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
    })
  const rows = [new TableRow({ children: headerRow.map((h) => mkCell(h, true)) })]
  dataRows.forEach((r) => rows.push(new TableRow({ children: r.map((c) => mkCell(c, false)) })))
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

export async function exportProductDocx(product: ProductRow): Promise<void> {
  const p = product.data
  const [versions, holdings] = await Promise.all([listProductVersions(product.id), listHoldings(product.id)])

  const children: (Paragraph | Table)[] = []
  children.push(new Paragraph({ text: p.name, heading: HeadingLevel.TITLE, spacing: { after: 60 } }))
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${p.category}  ·  Code: ${p.code}  ·  Status: ${product.status.toUpperCase()}  ·  v${versions.length}`,
          italics: true,
          color: '666666',
        }),
      ],
      spacing: { after: 240 },
    }),
  )

  children.push(h2('Key Facts'))
  children.push(kvPara('Risk Profile', p.riskProfile))
  children.push(kvPara('Asset Classes', (p.assetClasses || []).join('; ')))
  children.push(kvPara('Benchmark', p.benchmark))
  children.push(kvPara('Rebalance Frequency', p.rebalanceFrequency))
  children.push(kvPara('Minimum Investment', p.minInvestment || '—'))
  children.push(kvPara('Fees', p.fees || '—'))

  children.push(h2('Investment Objective'))
  children.push(body(p.objective))

  children.push(h2('Philosophy & Methodology'))
  children.push(body(p.philosophy || p.selectionMethodology || ''))
  if (p.portfolioConstruction) children.push(kvPara('Portfolio Construction', p.portfolioConstruction))
  if (isGoalBased(p) && p.portfolioConstructionNote) children.push(body(p.portfolioConstructionNote))
  if (isSingleSleeve(p)) {
    const r = p.portfolioConstructionRules
    children.push(kvPara('Stock Count Range', formatMinMaxRange(r?.stockCountMin, r?.stockCountMax)))
    children.push(kvPara('Caps & Position Sizing', formatCapsSentence(r)))
    children.push(kvPara('Cash Buffer', formatMinMaxRange(r?.cashBufferMinPct, r?.cashBufferMaxPct, '%')))
  }

  if (isSingleSleeve(p)) {
    children.push(h2('Style Sleeves'))
    children.push(
      simpleTable(
        ['Sleeve', 'Weight Range', 'Criteria', 'Universe', 'Indicative Names'],
        p.styleSleeves.map((s) => [s.name, formatMinMaxRange(s.sleeveMinPct, s.sleeveMaxPct, '%'), s.criteria, s.universe, s.indicativeNames]),
      ),
    )
  }

  if (isStrategicAllocation(p)) {
    children.push(h2('Strategic Allocation Ranges'))
    children.push(
      simpleTable(
        ['Sleeve', 'Target Range'],
        p.strategicAllocationRanges.map((a) => [a.sleeve, formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')]),
      ),
    )
  }

  if (isRiskVariant(p)) {
    children.push(h2('Risk-Profile Variants'))
    p.variants.forEach((v) => {
      children.push(
        new Paragraph({ children: [new TextRun({ text: v.profile, bold: true, size: 26 })], spacing: { before: 160, after: 80 } }),
      )
      if (v.targetInvestor) children.push(body(v.targetInvestor))
      if (v.factorMix) {
        children.push(kvPara('Factor Mix', v.factorMix))
        children.push(kvPara('Universe', v.universe))
        children.push(kvPara('Stock Count', v.stockCount))
        children.push(kvPara('Reference Index', v.referenceIndex))
        children.push(body(v.rationale))
      }
      if (v.allocation) {
        children.push(
          simpleTable(
            ['Sleeve', 'Target Range'],
            v.allocation.map((a) => [a.sleeve, formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')]),
          ),
        )
        if (v.expectedEquityLikeExposure) children.push(kvPara('Equity-like Exposure', v.expectedEquityLikeExposure))
      }
    })
  }

  if (isGoalBased(p)) {
    children.push(h2('Life Goal Framework (Glide Path)'))
    p.goalFramework.forEach((g) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${g.goal} — ${g.horizonBand}`, bold: true })],
          spacing: { before: 140, after: 60 },
        }),
      )
      children.push(body(g.glidePath))
      if (g.riskProfileAdjustment) children.push(kvPara('Risk-profile adjustment', g.riskProfileAdjustment))
    })
  }

  const instr = isStrategicAllocation(p)
    ? p.indicativeInstruments
    : isRiskVariant(p)
      ? p.indicativeInstruments || p.sharedInstrumentUniverse
      : undefined
  if (instr) {
    children.push(h2('Indicative Instrument Universe'))
    Object.keys(instr).forEach((k) => {
      children.push(kvPara(k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), instr[k] ?? ''))
    })
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              'Illustrative universe based on public data as of mid-2026. Reconfirm eligible instruments, tickers, and AUM/liquidity thresholds at each rebalance and before launch.',
            italics: true,
            color: '996600',
          }),
        ],
        spacing: { before: 80, after: 160 },
      }),
    )
  }

  if (holdings.length) {
    children.push(h2('Uploaded Constituents & Weights'))
    children.push(
      simpleTable(
        ['Symbol', 'Name', 'Weight'],
        holdings.map((hRow) => [hRow.instrument_code, hRow.instrument_name, hRow.weight_pct]),
      ),
    )
  }

  children.push(h2('Suitability'))
  children.push(body(p.suitability))

  children.push(h2('Key Risks'))
  ;(p.keyRisks || []).forEach((r) => children.push(bullet(r)))

  children.push(h2('Tax & Fees'))
  children.push(kvPara('Fees', p.fees || '—'))
  children.push(kvPara('Tax Treatment', p.taxNote || 'To be detailed in a future revision.'))

  children.push(h2('Disclosures'))
  children.push(
    new Paragraph({
      children: [new TextRun({ text: p.disclosures || DEFAULT_DISCLOSURES_TEXT, size: 16, color: '888888' })],
      spacing: { after: 160 },
    }),
  )

  if (versions.length) {
    children.push(h2('Version History'))
    versions.forEach((v) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `v${v.version_number} — ${new Date(v.created_at).toLocaleString()}${v.note ? ' — ' + v.note : ''}`,
              size: 19,
            }),
          ],
          spacing: { after: 60 },
        }),
      )
    })
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Product code ${p.code} · Status: ${product.status.toUpperCase()} · Internal / product-development document. Not investor-facing until reviewed for SEBI Research Analyst / smallcase compliance requirements, final fee structure, and tax disclosures.`,
          italics: true,
          size: 18,
          color: '888888',
        }),
      ],
      spacing: { before: 300 },
    }),
  )

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${p.code}_${product.id}_ProductNote.docx`)
}
