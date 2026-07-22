import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { saveAs } from 'file-saver'
import type { ProductRow } from '../data/types'
import { listProductVersions } from '../data/products'
import { listHoldings } from '../data/holdings'
import { formatCapsSentence, formatMinMaxRange } from './capsFormat'
import { isGoalBased, isRiskVariant, isSingleSleeve, isStrategicAllocation } from './archetype'
import { DEFAULT_DISCLOSURES_TEXT } from './disclosures'
import { DOC_FONT_WORD, DOC_THEME_HEX } from './docTheme'

/**
 * Word export -- ported from the frozen app's exportDocx (repo root
 * index.html), field-name-adapted the same way exportExcel.ts was: numeric
 * min/max cap fields via formatMinMaxRange/formatCapsSentence in place of
 * the frozen app's free-text weightRange/range/stockCountRange/cashBuffer,
 * and archetype-scoped fields (portfolioConstructionNote) gated behind the
 * matching type guard instead of an untyped `if(p.field)` check. Same async
 * structural difference as exportExcel.ts: versions and holdings are
 * fetched from Supabase rather than read from in-memory state.
 *
 * Styling fixed after R4 functional verification: this file previously used
 * ad hoc greys ('666666'/'996600'/'888888') and no explicit font at all, so
 * it matched neither the Vriksha palette nor exportPdf.ts's look. Every
 * color below now comes from docTheme.ts (the same source exportPdf.ts
 * draws from), and the whole document defaults to Arial via the `styles`
 * block on `Document` -- see docTheme.ts for why Arial/Helvetica specifically
 * rather than the app's on-screen Lora.
 */

const TABLE_BORDER_HEX = 'DCE1DC' // matches exportPdf.ts's TABLE_LINE_COLOR [220,225,220]

/**
 * Document-level defaults (`default.document.run`) plus explicit overrides
 * for the two heading styles this file actually uses (`HeadingLevel.TITLE`
 * for the product name, `HeadingLevel.HEADING_2` for every section heading
 * via h2() below). Without these overrides docx's own built-in default
 * heading styles win, which is exactly how this file ended up with an
 * unstyled black/default-blue heading look that matched neither
 * exportPdf.ts's forest-green headings nor the rest of this document's now-
 * themed body text.
 */
/**
 * Corrected after independent review caught a real bug in the first version
 * of this: overriding Word's built-in Title/Heading2 look via a top-level
 * `styles.paragraphStyles` array (with `id: 'Title'`/`id: 'Heading2'`)
 * doesn't replace docx's own built-in style definitions -- `Document`'s
 * `styles.default` option already generates its own Title/Heading2 style
 * entries, and `paragraphStyles` entries are *added alongside* them, not
 * merged by id. The review built the actual .docx and inspected
 * `word/styles.xml` directly: it contained two `<w:style styleId="Title">`
 * elements, a genuine duplicate-styleId condition -- confirmed
 * parser-dependent (python-docx resolved to the first/built-in/unstyled
 * definition; LibreOffice resolved to the second/custom one), meaning
 * whether the intended styling actually showed up was not guaranteed by the
 * API contract at all, even though it might happen to render correctly in
 * any one reader. The documented way to override a built-in style
 * (confirmed against the pinned `docx` package's own `factory.d.ts`,
 * `IDefaultStylesOptions`) is `styles.default.title` / `.heading2` --
 * these replace the built-in definition outright rather than adding a
 * second, competing one.
 */
const WORD_THEME_STYLES = {
  default: {
    document: {
      run: { font: DOC_FONT_WORD, size: 22, color: DOC_THEME_HEX.ink }, // 22 half-points = 11pt body
    },
    title: {
      run: { font: DOC_FONT_WORD, size: 56, bold: true, color: DOC_THEME_HEX.forest }, // 56 half-points = 28pt
    },
    heading2: {
      run: { font: DOC_FONT_WORD, size: 26, bold: true, color: DOC_THEME_HEX.forest }, // 26 half-points = 13pt
    },
  },
}

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 2, color: TABLE_BORDER_HEX }
const TABLE_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER,
  insideVertical: TABLE_BORDER,
}

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
    children: [new TextRun({ text: k + ': ', bold: true, color: DOC_THEME_HEX.moss }), new TextRun(v || '—')],
    spacing: { after: 80 },
  })
}

/**
 * Header row shaded moss with white bold text, data rows alternately
 * striped -- matches exportPdf.ts's pdfTable() (`headStyles`/
 * `alternateRowStyles`) exactly, rather than the plain black-on-white table
 * this used to render as its own, unrelated default.
 */
function simpleTable(headerRow: string[], dataRows: (string | number)[][]): Table {
  const mkCell = (text: string | number, opts: { bold: boolean; color?: string; fill?: string }) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: opts.bold, color: opts.color })] })],
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    })
  const rows = [
    new TableRow({
      children: headerRow.map((h) => mkCell(h, { bold: true, color: DOC_THEME_HEX.white, fill: DOC_THEME_HEX.moss })),
    }),
  ]
  dataRows.forEach((r, i) => {
    const fill = i % 2 === 1 ? DOC_THEME_HEX.tableStripe : undefined
    rows.push(new TableRow({ children: r.map((c) => mkCell(c, { bold: false, fill })) }))
  })
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS })
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
          color: DOC_THEME_HEX.sage,
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
            color: DOC_THEME_HEX.gold,
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
      children: [new TextRun({ text: p.disclosures || DEFAULT_DISCLOSURES_TEXT, size: 16, color: DOC_THEME_HEX.faint })],
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
          color: DOC_THEME_HEX.faint,
        }),
      ],
      spacing: { before: 300 },
    }),
  )

  const doc = new Document({ styles: WORD_THEME_STYLES, sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${p.code}_${product.id}_ProductNote.docx`)
}
