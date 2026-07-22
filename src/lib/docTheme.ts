/**
 * Single shared color/font source of truth for exportPdf.ts and
 * exportWord.ts. Before this file existed, exportWord.ts used ad hoc greys
 * ('666666', '996600', '888888') that matched neither exportPdf.ts's own
 * PDF_THEME nor the app's on-screen palette (design-system/tokens.css), and
 * neither export set an explicit font, so each silently fell back to its
 * own library's default (Word's default document font vs. jsPDF's
 * Helvetica) instead of a deliberate shared choice. Reported by the user
 * during R4 functional verification as "not in the same format as the
 * Vriksha design palette and also different from the font in the PDF."
 *
 * Colors are darkened/adjusted from tokens.css's dark-mode UI values for
 * legibility on a white page -- exportPdf.ts's PDF_THEME already documented
 * this reasoning for `sage`/`gold`; this file centralizes it so both
 * exports draw from the same values instead of drifting independently.
 *
 * Font: jsPDF's built-in fonts are Helvetica/Times/Courier only --
 * embedding a custom TTF (e.g. Lora, the app's on-screen brand font) is a
 * real added build step, not a one-line change, and dense financial-document
 * body text favors a plain, highly-legible face over a display serif
 * regardless. Rather than embed a font for PDF alone and leave Word on a
 * different one, both exports use the closest common, pre-installed,
 * license-free equivalents: Helvetica for PDF (jsPDF's default), Arial for
 * Word (the universal Windows/Mac substitute for Helvetica, metric-
 * compatible) -- visually near-identical, no font embedding required on
 * either side.
 */

export const DOC_THEME_HEX = {
  forest: '0F1A12', // titles, section headings -- matches tokens.css --forest
  moss: '2D4A32', // kv labels, table header fills, rules -- matches tokens.css --moss
  sage: '5A6E5E', // subtitles, secondary text -- darkened from tokens.css --sage (#7a9e7e) for legibility on white
  gold: '967A2D', // accents, bullet markers, callouts -- darkened from tokens.css --gold (#c4a84f) for legibility on white
  ink: '1E2620', // body text
  faint: '78827A', // footers, disclosures, meta text
  tableStripe: 'F5F8F5', // alternating table row fill
  white: 'FFFFFF',
} as const

/** jsPDF wants `[r, g, b]` tuples, not hex strings -- derive from the same source instead of hand-maintaining two copies. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const DOC_FONT_PDF = 'helvetica'
export const DOC_FONT_WORD = 'Arial'
