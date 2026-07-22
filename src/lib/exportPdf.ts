import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ProductRow } from '../data/types'
import { listProductVersions } from '../data/products'
import { formatCapsSentence, formatMinMaxRange } from './capsFormat'
import { isGoalBased, isRiskVariant, isSingleSleeve, isStrategicAllocation } from './archetype'
import { DEFAULT_DISCLOSURES_TEXT } from './disclosures'

/**
 * PDF export -- ported from the frozen app's PDF_THEME / pdfNewDoc / pdfHeader /
 * pdfFooter / pdfSectionHeading / pdfBody / pdfKv / pdfBullets / pdfTable /
 * exportPdf / exportClientSummaryPdf (repo root index.html), field-name-adapted
 * the same way exportExcel.ts and exportWord.ts were.
 *
 * Typing note, corrected after an independent review caught the original
 * version of this comment being wrong: `jspdf-autotable`'s published
 * `.d.ts` (checked directly against the pinned `jspdf-autotable@3.8.2` and
 * `jspdf@2.5.2` packages, not assumed) does NOT augment the `jsPDF` class --
 * there is no `declare module "jspdf" { interface jsPDF { autoTable... } }`
 * anywhere in either package. The frozen app's `doc.autoTable(...)`/
 * `doc.lastAutoTable` calling convention (repo root index.html) only worked
 * there because it's untyped JS; a literal port of that calling convention
 * to TypeScript does not compile. At runtime, importing `jspdf-autotable`
 * *does* monkey-patch `jsPDF.API.autoTable` (confirmed by reading the
 * package's actual bundled JS, not just its types), so `doc.autoTable(...)`
 * would technically still work in the browser -- but relying on an
 * untyped-at-compile-time method that happens to exist at runtime is worse
 * than using the API the package actually ships types for. `autoTable` is
 * imported here as the package's typed default export and called as
 * `autoTable(doc, options)` instead of `doc.autoTable(options)` -- fully
 * typed, no cast. Reading the result back (`doc.lastAutoTable.finalY`) is
 * still untyped by either package (confirmed the same way), so
 * `readFinalY()` below still goes through a narrow `unknown` cast rather
 * than `any` -- that part of the original design was correct.
 */

type RGB = [number, number, number]

const PDF_THEME = {
  forest: [15, 26, 18] as RGB, // #0f1a12 -- headings
  moss: [45, 74, 50] as RGB, // #2d4a32 -- section rules, sub-headings
  sage: [90, 110, 94] as RGB, // darkened from #7a9e7e for legibility on white
  gold: [150, 122, 45] as RGB, // darkened from #c4a84f for legibility on white
  ink: [30, 38, 32] as RGB, // body text
  faint: [120, 130, 122] as RGB, // meta text, footers
  pageWidth: 210, // A4 mm
  margin: 18,
}

/**
 * Uniform body-text size and leading, used by pdfBody/pdfKv/pdfBullets so
 * adjacent sections don't visually mismatch. Previously pdfBody rendered at
 * 9.5pt with leading `size*0.42+2.2`, while pdfKv rendered its value text at
 * a hardcoded 9pt with a hardcoded 4.3mm/line leading and pdfBullets used
 * 9.5pt with the same hardcoded 4.3mm/line -- three different leading
 * ratios stacked directly on top of each other (e.g. Key Facts vs. the
 * Objective paragraph right below it), which is what read as "inconsistent
 * font sizing and line spacing" in a side-by-side read of the exported PDF.
 * All three now share BODY_SIZE and lineHeight().
 */
const BODY_SIZE = 9.5
function lineHeight(size: number): number {
  return size * 0.42 + 2.2
}

/**
 * jsPDF's built-in 'helvetica' font only supports WinAnsiEncoding (~CP1252).
 * Most "smart" typography (curly quotes, em/en dash, bullet, ellipsis) IS
 * part of that set and renders fine -- but a handful of characters people
 * commonly type in financial prose are NOT, and jsPDF doesn't error on them;
 * it silently corrupts glyph spacing/kerning for the rest of the line. This
 * is the confirmed root cause of the "weird text after 'trigger events'" bug
 * reported on the DSOP product's exported PDF: its rebalanceFrequency field
 * (verified directly against Supabase, full and un-truncated at 184 chars)
 * contains a Unicode minus sign, U+2212 ("stop-loss breach at −20% from
 * entry") -- a different codepoint from the ASCII hyphen U+002D, and outside
 * WinAnsiEncoding. Applied to every string this file passes to
 * doc.text()/splitTextToSize()/autoTable() so a stray character typed into
 * any free-text field can't silently corrupt an export again.
 */
const PDF_SAFE_EXTRA_CHARS = new Set([
  '‘', '’', '‚', // ‘ ’ ‚
  '“', '”', '„', // “ ” „
  '–', '—', // – —
  '†', '‡', // † ‡
  '•', // •
  '…', // …
  '‰', // ‰
  '‹', '›', // ‹ ›
  '™', // ™
  '€', // €
])

const PDF_UNSAFE_CHAR_MAP: Record<string, string> = {
  '−': '-', // minus sign -- the actual DSOP bug (not the same as ASCII hyphen)
  '‐': '-',
  '‑': '-',
  '―': '-',
  '₹': 'Rs. ', // Indian Rupee sign
  '→': '->',
  '←': '<-',
  '≤': '<=',
  '≥': '>=',
  '≈': '~',
}

function sanitizePdfText(input: string): string {
  let out = input
  for (const [bad, good] of Object.entries(PDF_UNSAFE_CHAR_MAP)) {
    if (out.includes(bad)) out = out.split(bad).join(good)
  }
  return Array.from(out)
    .map((ch) => (ch.charCodeAt(0) <= 0xff || PDF_SAFE_EXTRA_CHARS.has(ch) ? ch : '?'))
    .join('')
}

function pdfNewDoc(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

function pdfHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const m = PDF_THEME.margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...PDF_THEME.gold)
  doc.text('VRIKSHA', m, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...PDF_THEME.sage)
  doc.text('PRODUCT NOTE STUDIO', m, 18)
  doc.setDrawColor(...PDF_THEME.moss)
  doc.setLineWidth(0.4)
  doc.line(m, 21, PDF_THEME.pageWidth - m, 21)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...PDF_THEME.forest)
  const titleLines = doc.splitTextToSize(sanitizePdfText(title), PDF_THEME.pageWidth - 2 * m)
  doc.text(titleLines, m, 30)
  let y = 30 + titleLines.length * 6.5
  if (subtitle) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(BODY_SIZE)
    doc.setTextColor(...PDF_THEME.sage)
    doc.text(sanitizePdfText(subtitle), m, y)
    y += 6
  }
  return y + 2
}

function pdfFooter(doc: jsPDF, footnote?: string): void {
  // getNumberOfPages() is a direct method on jsPDF, not on .internal --
  // the frozen app's doc.internal.getNumberOfPages() (repo root index.html)
  // only worked because it's untyped JS reaching past what jsPDF's own
  // type declarations expose. Confirmed against the actual jspdf@2.5.2
  // .d.ts: `internal` is typed as { events, scaleFactor, pageSize, pages,
  // getEncryptor }, no getNumberOfPages member.
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const m = PDF_THEME.margin
    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...PDF_THEME.moss)
    doc.setLineWidth(0.2)
    doc.line(m, pageH - 14, PDF_THEME.pageWidth - m, pageH - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...PDF_THEME.faint)
    if (footnote) {
      const lines = doc.splitTextToSize(sanitizePdfText(footnote), PDF_THEME.pageWidth - 2 * m - 20)
      doc.text(lines, m, pageH - 10)
    }
    doc.text(`${i} / ${pageCount}`, PDF_THEME.pageWidth - m, pageH - 10, { align: 'right' })
  }
}

function pdfSectionHeading(doc: jsPDF, text: string, y: number): number {
  const m = PDF_THEME.margin
  if (y > 260) {
    doc.addPage()
    y = 24
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...PDF_THEME.forest)
  doc.text(text.toUpperCase(), m, y)
  doc.setDrawColor(...PDF_THEME.gold)
  doc.setLineWidth(0.6)
  doc.line(m, y + 1.5, m + 14, y + 1.5)
  return y + 7
}

function pdfBody(doc: jsPDF, text: string | undefined | null, y: number, opts?: { size?: number; bold?: boolean; color?: RGB }): number {
  const o = opts || {}
  const m = PDF_THEME.margin
  const size = o.size || BODY_SIZE
  doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...(o.color || PDF_THEME.ink))
  const lines = doc.splitTextToSize(sanitizePdfText(text || '—'), PDF_THEME.pageWidth - 2 * m)
  lines.forEach((line: string) => {
    if (y > 275) {
      doc.addPage()
      y = 24
    }
    doc.text(line, m, y)
    y += lineHeight(size)
  })
  return y + 2
}

function pdfKv(doc: jsPDF, k: string, v: string | undefined | null, y: number): number {
  const m = PDF_THEME.margin
  if (y > 272) {
    doc.addPage()
    y = 24
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(BODY_SIZE)
  doc.setTextColor(...PDF_THEME.moss)
  const label = sanitizePdfText(k) + ':'
  doc.text(label, m, y)
  const kw = doc.getTextWidth(label + '  ')
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...PDF_THEME.ink)
  const lines = doc.splitTextToSize(sanitizePdfText(v == null ? '—' : String(v)), PDF_THEME.pageWidth - 2 * m - kw)
  doc.text(lines, m + kw, y)
  return y + Math.max(lines.length, 1) * lineHeight(BODY_SIZE) + 2
}

function pdfBullets(doc: jsPDF, items: string[] | undefined, y: number): number {
  const m = PDF_THEME.margin
  ;(items || []).forEach((item) => {
    if (y > 272) {
      doc.addPage()
      y = 24
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(BODY_SIZE)
    doc.setTextColor(...PDF_THEME.gold)
    doc.text('—', m, y)
    doc.setTextColor(...PDF_THEME.ink)
    const lines = doc.splitTextToSize(sanitizePdfText(item), PDF_THEME.pageWidth - 2 * m - 6)
    doc.text(lines, m + 5, y)
    y += lines.length * lineHeight(BODY_SIZE)
  })
  return y + 2
}

const WHITE: RGB = [255, 255, 255]
const TABLE_LINE_COLOR: RGB = [220, 225, 220]
const TABLE_STRIPE_COLOR: RGB = [245, 248, 245]

/**
 * Reads `doc.lastAutoTable.finalY` through an `unknown` cast. Corrected
 * after independent review checked the actual published `.d.ts` for both
 * `jspdf@2.5.2` and `jspdf-autotable@3.8.2`: neither package declares
 * `lastAutoTable` on `jsPDF` at all (this file's earlier comment guessed at
 * a "broader declared type" that doesn't actually exist). At runtime,
 * `autoTable(doc, options)` does set `doc.lastAutoTable = table` as a plain
 * side effect (confirmed against the package's actual bundled JS), so the
 * value is real -- it's just not one either package's types expose. This
 * keeps the no-`any` rule (rebuild/ROADMAP.md R2) while reading a real
 * runtime property TypeScript has no declared shape for -- narrower than
 * `any`, still fails loudly if the runtime shape is ever genuinely wrong.
 */
function readFinalY(doc: jsPDF, fallback: number): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
  return (last?.finalY ?? fallback) + 6
}

function pdfTable(doc: jsPDF, head: string[], rows: (string | number)[][], y: number): number {
  autoTable(doc, {
    startY: y,
    head: [head.map((h) => sanitizePdfText(h))],
    body: rows.map((r) => r.map((c) => (typeof c === 'string' ? sanitizePdfText(c) : c))),
    margin: { left: PDF_THEME.margin, right: PDF_THEME.margin },
    styles: { font: 'helvetica', fontSize: 8.3, textColor: PDF_THEME.ink, cellPadding: 2.2, lineColor: TABLE_LINE_COLOR, lineWidth: 0.2 },
    headStyles: { fillColor: PDF_THEME.moss, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR },
  })
  return readFinalY(doc, y)
}

/** Full-note PDF -- content mirrors exportWord.ts's exportProductDocx exactly. */
export async function exportProductPdf(product: ProductRow): Promise<void> {
  const p = product.data
  const versions = await listProductVersions(product.id)
  const doc = pdfNewDoc()
  let y = pdfHeader(doc, p.name, `${p.category}  ·  Code: ${p.code}  ·  Status: ${product.status.toUpperCase()}  ·  v${versions.length}`)

  y = pdfSectionHeading(doc, 'Key Facts', y)
  y = pdfKv(doc, 'Risk Profile', p.riskProfile, y)
  y = pdfKv(doc, 'Asset Classes', (p.assetClasses || []).join('; '), y)
  y = pdfKv(doc, 'Benchmark', p.benchmark, y)
  y = pdfKv(doc, 'Rebalance Frequency', p.rebalanceFrequency, y)
  y = pdfKv(doc, 'Minimum Investment', p.minInvestment || '—', y)
  y = pdfKv(doc, 'Fees', p.fees || '—', y)

  y = pdfSectionHeading(doc, 'Investment Objective', y)
  y = pdfBody(doc, p.objective, y)

  y = pdfSectionHeading(doc, 'Philosophy & Methodology', y)
  y = pdfBody(doc, p.philosophy || p.selectionMethodology || '', y)
  if (p.portfolioConstruction) y = pdfKv(doc, 'Portfolio Construction', p.portfolioConstruction, y)
  if (isGoalBased(p) && p.portfolioConstructionNote) y = pdfBody(doc, p.portfolioConstructionNote, y)
  if (isSingleSleeve(p)) {
    const r = p.portfolioConstructionRules
    y = pdfKv(doc, 'Stock Count Range', formatMinMaxRange(r?.stockCountMin, r?.stockCountMax), y)
    y = pdfKv(doc, 'Caps & Position Sizing', formatCapsSentence(r), y)
    y = pdfKv(doc, 'Cash Buffer', formatMinMaxRange(r?.cashBufferMinPct, r?.cashBufferMaxPct, '%'), y)
  }

  if (isSingleSleeve(p)) {
    y = pdfSectionHeading(doc, 'Style Sleeves', y)
    y = pdfTable(
      doc,
      ['Sleeve', 'Weight Range', 'Universe'],
      p.styleSleeves.map((s) => [s.name, formatMinMaxRange(s.sleeveMinPct, s.sleeveMaxPct, '%'), s.universe || '—']),
      y,
    )
  }

  if (isStrategicAllocation(p)) {
    y = pdfSectionHeading(doc, 'Strategic Allocation Ranges', y)
    y = pdfTable(
      doc,
      ['Sleeve', 'Target Range'],
      p.strategicAllocationRanges.map((a) => [a.sleeve, formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')]),
      y,
    )
  }

  if (isRiskVariant(p)) {
    y = pdfSectionHeading(doc, 'Risk-Profile Variants', y)
    p.variants.forEach((v) => {
      if (y > 260) {
        doc.addPage()
        y = 24
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...PDF_THEME.moss)
      doc.text(sanitizePdfText(v.profile), PDF_THEME.margin, y)
      y += 5.5
      if (v.targetInvestor) y = pdfBody(doc, v.targetInvestor, y, { size: BODY_SIZE })
      if (v.factorMix) {
        y = pdfKv(doc, 'Factor Mix', v.factorMix, y)
        y = pdfKv(doc, 'Universe', v.universe, y)
        y = pdfKv(doc, 'Stock Count', v.stockCount, y)
      }
      if (v.allocation) {
        y = pdfTable(doc, ['Sleeve', 'Target Range'], v.allocation.map((a) => [a.sleeve, formatMinMaxRange(a.sleeveMinPct, a.sleeveMaxPct, '%')]), y)
        if (v.expectedEquityLikeExposure) y = pdfKv(doc, 'Equity-like Exposure', v.expectedEquityLikeExposure, y)
      }
      y += 2
    })
  }

  if (isGoalBased(p)) {
    y = pdfSectionHeading(doc, 'Life Goal Framework (Glide Path)', y)
    p.goalFramework.forEach((g) => {
      if (y > 265) {
        doc.addPage()
        y = 24
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(BODY_SIZE)
      doc.setTextColor(...PDF_THEME.moss)
      doc.text(sanitizePdfText(`${g.goal} — ${g.horizonBand}`), PDF_THEME.margin, y)
      y += 5
      y = pdfBody(doc, g.glidePath, y, { size: BODY_SIZE })
    })
  }

  y = pdfSectionHeading(doc, 'Suitability', y)
  y = pdfBody(doc, p.suitability, y)

  y = pdfSectionHeading(doc, 'Key Risks', y)
  y = pdfBullets(doc, p.keyRisks, y)

  y = pdfSectionHeading(doc, 'Tax & Fees', y)
  y = pdfKv(doc, 'Fees', p.fees || '—', y)
  y = pdfKv(doc, 'Tax Treatment', p.taxNote || 'To be detailed in a future revision.', y)

  y = pdfSectionHeading(doc, 'Disclosures', y)
  y = pdfBody(doc, p.disclosures || DEFAULT_DISCLOSURES_TEXT, y, { size: 8, color: PDF_THEME.faint })

  pdfFooter(
    doc,
    `Product code ${p.code} · Status: ${product.status.toUpperCase()} · Internal / product-development document. Not investor-facing until reviewed for SEBI Research Analyst / smallcase compliance requirements, final fee structure, and tax disclosures.`,
  )
  doc.save(`${p.code}_${product.id}_ProductNote.pdf`)
}

/** Short-form client summary PDF -- fixed field set, 1-2 pages. */
export async function exportClientSummaryPdf(product: ProductRow): Promise<void> {
  const p = product.data
  const doc = pdfNewDoc()
  let y = pdfHeader(doc, p.shortName || p.name, p.category)

  y = pdfSectionHeading(doc, 'Objective', y)
  y = pdfBody(doc, p.objective, y)

  y = pdfSectionHeading(doc, 'Key Facts', y)
  y = pdfKv(doc, 'Risk Profile', p.riskProfile, y)
  y = pdfKv(doc, 'Benchmark', p.benchmark, y)
  y = pdfKv(doc, 'Minimum Investment', p.minInvestment || '—', y)

  y = pdfSectionHeading(doc, 'Suitability', y)
  y = pdfBody(doc, p.suitability, y)

  y = pdfSectionHeading(doc, 'Key Risks', y)
  y = pdfBullets(doc, (p.keyRisks || []).slice(0, 5), y)

  y = pdfSectionHeading(doc, 'Disclosures', y)
  pdfBody(doc, p.disclosures || DEFAULT_DISCLOSURES_TEXT, y, { size: 8, color: PDF_THEME.faint })

  pdfFooter(doc, 'Summary overview for discussion purposes — not a complete product note. Full terms, fees, and risk disclosures available on request.')
  doc.save(`${p.code}_${product.id}_ClientSummary.pdf`)
}
