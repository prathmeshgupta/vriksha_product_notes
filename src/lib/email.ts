import type { ProductRow } from '../data/types'
import { listProductVersions } from '../data/products'

/**
 * mailto: quick-email -- ported verbatim from the frozen app's
 * productToPlainText/buildMailtoUrl/emailNote (repo root index.html). No
 * field-name adaptation needed here (unlike exportExcel/exportWord/exportPdf):
 * this only touches name/code/category/riskProfile/benchmark/rebalanceFrequency/
 * objective/philosophy/keyRisks, none of which were affected by R3's
 * cap-field restructuring.
 *
 * mailto: links are unreliable above ~1800-2000 encoded characters across
 * mail clients (Outlook in particular truncates aggressively) -- so this
 * produces a concise summary, not the full note. Full notes go via the
 * Word/Excel/PDF export functions in this same lib/ folder.
 *
 * Structural difference from the frozen app: `entry.versions.length` was an
 * in-memory read there; here it requires a Supabase round-trip
 * (listProductVersions), so productToPlainText/buildMailtoUrl take the
 * version count as a plain number argument (kept synchronous and pure, so
 * they stay easy to unit test) and only the top-level emailNote() is async.
 */

export function productToPlainText(product: ProductRow, versionCount: number, opts?: { maxLen?: number }): string {
  const p = product.data
  const maxLen = opts?.maxLen || 1100 // soft target for the body text portion
  const footer =
    '\n\n— Sent from Vriksha Product Note Studio. This is a summary; full structured detail (allocation bands, variants, instrument universe) is in the Word/Excel export.'

  // Fixed, always-included header -- facts + full objective + full risk list.
  // These are the highest-value fields for a quick email; philosophy is the
  // one section allowed to be trimmed or dropped if space runs short.
  const headerLines: string[] = []
  headerLines.push(p.name)
  headerLines.push(`${p.code} · ${p.category} · Status: ${product.status.toUpperCase()} (v${versionCount})`)
  headerLines.push('')
  headerLines.push(`Risk Profile: ${p.riskProfile}`)
  headerLines.push(`Benchmark: ${p.benchmark}`)
  headerLines.push(`Rebalance: ${p.rebalanceFrequency}`)
  headerLines.push('')
  headerLines.push('OBJECTIVE')
  headerLines.push(p.objective || '')
  headerLines.push('')

  const riskLines: string[] = []
  if (p.keyRisks && p.keyRisks.length) {
    riskLines.push('KEY RISKS')
    p.keyRisks.forEach((r) => riskLines.push('- ' + r))
    riskLines.push('')
  }

  const header = headerLines.join('\n')
  const risks = riskLines.join('\n')
  const fixedBudgetUsed = header.length + risks.length + footer.length
  const remaining = maxLen - fixedBudgetUsed

  let philosophyBlock = ''
  if (p.philosophy && remaining > 60) {
    const label = 'PHILOSOPHY\n'
    const available = remaining - label.length - 2 // small buffer
    let phil = p.philosophy
    if (phil.length > available) {
      phil = phil.slice(0, Math.max(0, available - 20)).trim() + ' [...see full export]'
    }
    philosophyBlock = label + phil + '\n\n'
  }

  let text = header + philosophyBlock + risks + footer.trim()

  // Backstop: if objective + risks alone exceed the budget (rare -- a
  // product with an unusually long risk list), hard-truncate rather than
  // send an oversized mailto: URL that some clients will silently reject.
  const hardCap = Math.max(maxLen, 400) + 400 // small grace band beyond the soft target
  if (text.length > hardCap) {
    text = text.slice(0, hardCap - 40).trim() + '\n\n[...truncated — see full export for complete note]'
  }
  return text
}

export function buildMailtoUrl(product: ProductRow, versionCount: number): string {
  const bodyText = productToPlainText(product, versionCount)
  const subject = `Product Note — ${product.data.name} (${product.data.code})`
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
}

export async function emailNote(product: ProductRow): Promise<void> {
  const versions = await listProductVersions(product.id)
  window.location.href = buildMailtoUrl(product, versions.length)
}

/**
 * Webmail options -- added after a user report that `mailto:` opening the
 * local desktop mail client is "cumbersome" (many machines have no desktop
 * client configured, or a different one than the user actually checks).
 * These build the same subject/body into each provider's own web-compose
 * deep link so it opens in the browser, prefilled and ready to review/edit/
 * send -- 'default' keeps the original mailto: behavior for anyone who does
 * want their desktop client. All four share productToPlainText's existing
 * ~1100-character soft budget (see that function's own comment on mailto:
 * length limits); the webmail providers don't have that same URL-length
 * ceiling, but a consistent, concise body across all four options is more
 * useful than one that varies by provider and reads better to a recipient.
 */
export type EmailProvider = 'gmail' | 'outlook' | 'yahoo' | 'default'

export const EMAIL_PROVIDER_LABELS: Record<EmailProvider, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  yahoo: 'Yahoo',
  default: 'Desktop email app',
}

export function buildWebmailUrl(provider: EmailProvider, product: ProductRow, versionCount: number): string {
  const bodyText = productToPlainText(product, versionCount)
  const subject = `Product Note — ${product.data.name} (${product.data.code})`
  const enc = { s: encodeURIComponent(subject), b: encodeURIComponent(bodyText) }
  switch (provider) {
    case 'gmail':
      return `https://mail.google.com/mail/?view=cm&fs=1&su=${enc.s}&body=${enc.b}`
    case 'outlook':
      return `https://outlook.live.com/mail/0/deeplink/compose?subject=${enc.s}&body=${enc.b}`
    case 'yahoo':
      return `https://compose.mail.yahoo.com/?subject=${enc.s}&body=${enc.b}`
    case 'default':
    default:
      return buildMailtoUrl(product, versionCount)
  }
}

/**
 * `default` navigates the current tab (mailto: links don't open anything to
 * switch away from -- the OS handles them in place). Every webmail provider
 * opens in a new tab instead of replacing the studio tab, since the whole
 * point is "review, edit, and send" in the browser without losing your place
 * in the app.
 */
export async function emailNoteVia(product: ProductRow, provider: EmailProvider): Promise<void> {
  const versions = await listProductVersions(product.id)
  const url = buildWebmailUrl(provider, product, versions.length)
  if (provider === 'default') {
    window.location.href = url
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
