import { sb } from './supabaseClient'
import type { ProductRow, ProductVersionRow, ProductNoteData } from './types'

/**
 * Typed data-access layer for the `products` and `product_versions` tables.
 * UI components call these functions rather than making raw Supabase calls
 * directly -- this is one of the concrete structural improvements the
 * rebuild is meant to deliver over the frozen app's approach (see
 * rebuild/STRATEGY.md, rebuild/ARCHITECTURE.md §3).
 *
 * Scope note: this is R2 (data layer) territory -- reading/writing the
 * existing schema correctly. The *workflow* around these functions (confirm
 * dialogs, publish-note prompts, diff views, the compliance publish-gate)
 * belongs to the UI layer built in R3/R6, not here. Behavior below is
 * ported to match the frozen app's Supabase writes exactly (verified
 * against repo root index.html's persistProduct/publishProduct/
 * insertNewProduct/archiveProduct on 2026-07-16), minus the UI-layer
 * confirm()/prompt() calls, which the caller owns.
 */

export async function listProducts(options?: { includeArchived?: boolean }): Promise<ProductRow[]> {
  let query = sb.from('products').select('*').order('id')
  if (!options?.includeArchived) {
    query = query.eq('archived', false)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ProductRow[]
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const { data, error } = await sb.from('products').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ProductRow | null
}

/**
 * One published-version count per product, in a single query -- used by the
 * overview grid and sidebar nav (R3) so listing N products doesn't fire N
 * separate `listProductVersions` calls. Not part of the frozen app (which
 * had every version already loaded into in-memory state); an addition
 * specific to the normalized-table Supabase model this rebuild uses.
 */
export async function listVersionCounts(): Promise<Map<string, number>> {
  const { data, error } = await sb.from('product_versions').select('product_id')
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const id = row.product_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export async function listProductVersions(productId: string): Promise<ProductVersionRow[]> {
  const { data, error } = await sb
    .from('product_versions')
    .select('*')
    .eq('product_id', productId)
    .order('version_number', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProductVersionRow[]
}

/**
 * Saves a working draft's edits without creating a new version -- matches
 * the frozen app's persistProduct(): updates data/status/archived plus the
 * denormalized code/name/short_name/category/regulatory_regime columns
 * (kept in sync with `data` for querying/filtering), stamped with the
 * current user as updated_by.
 */
export async function persistProduct(
  id: string,
  patch: { data: ProductNoteData; status: 'draft' | 'published'; archived: boolean },
): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { error } = await sb
    .from('products')
    .update({
      data: patch.data,
      status: patch.status,
      archived: patch.archived,
      code: patch.data.code,
      name: patch.data.name,
      short_name: patch.data.shortName || null,
      category: patch.data.category,
      regulatory_regime: patch.data.regulatoryRegime || 'india_sebi',
      updated_by: user?.id ?? null,
    })
    .eq('id', id)

  if (error) throw error
}

/**
 * Publishes a new version -- matches the frozen app's publishProduct() DB
 * mechanics exactly: version_number = existing version count + 1, insert
 * into product_versions, then update products.status='published' with the
 * same data snapshot. Does NOT include the compliance publish-gate (R6) or
 * the note-prompt/confirm UI (R3) -- caller supplies `note` already decided.
 */
export async function publishProduct(
  id: string,
  data: ProductNoteData,
  note: string,
): Promise<{ versionNumber: number }> {
  const {
    data: { user },
  } = await sb.auth.getUser()

  const existingVersions = await listProductVersions(id)
  const versionNumber = existingVersions.length + 1
  // Deep-clone so later in-memory edits to `data` can't mutate the snapshot
  // already sent to Supabase -- same defensive copy the frozen app makes.
  const snapshot = JSON.parse(JSON.stringify(data)) as ProductNoteData

  const { error: versionError } = await sb.from('product_versions').insert({
    product_id: id,
    version_number: versionNumber,
    note: note || '',
    data: snapshot,
    created_by: user?.id ?? null,
  })
  if (versionError) throw versionError

  const { error: productError } = await sb
    .from('products')
    .update({ status: 'published', data: snapshot, updated_by: user?.id ?? null })
    .eq('id', id)
  if (productError) throw productError

  return { versionNumber }
}

export async function unpublishToDraft(id: string, data: ProductNoteData): Promise<void> {
  await persistProduct(id, { data, status: 'draft', archived: false })
}

export async function archiveProduct(id: string, data: ProductNoteData, status: 'draft' | 'published'): Promise<void> {
  await persistProduct(id, { data, status, archived: true })
}

export async function unarchiveProduct(id: string, data: ProductNoteData, status: 'draft' | 'published'): Promise<void> {
  await persistProduct(id, { data, status, archived: false })
}

/**
 * Matches the frozen app's nextProductId(): finds the lowest-numbered
 * unused "PN{n}" id starting from 10 (P1-P9 are the seeded base products,
 * PN10+ are user-created). Queries Supabase directly rather than relying on
 * in-memory state, since R2 has no global product cache yet (that's R3).
 */
export async function getNextProductId(): Promise<string> {
  const { data, error } = await sb.from('products').select('id')
  if (error) throw error
  const existingIds = new Set((data ?? []).map((row) => row.id as string))
  let n = 10
  while (existingIds.has('PN' + n)) n++
  return 'PN' + n
}

/**
 * Shared low-level insert -- matches the frozen app's insertNewProduct(),
 * the single place that writes a new row into `products` regardless of
 * which of the 3 create-paths (blank/template/existing) is used.
 */
export async function insertNewProduct(id: string, data: ProductNoteData): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { error } = await sb.from('products').insert({
    id,
    code: data.code,
    name: data.name,
    short_name: data.shortName || null,
    category: data.category,
    status: 'draft',
    archived: false,
    data,
    regulatory_regime: data.regulatoryRegime || 'india_sebi',
    updated_by: user?.id ?? null,
  })
  if (error) throw error
}
