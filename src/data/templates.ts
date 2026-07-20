import { sb } from './supabaseClient'
import type { Archetype, ProductNoteData, TemplateRow } from './types'

/**
 * Typed CRUD for the `templates` table.
 *
 * Includes the frozen app's template shape-validation guard (repo root
 * index.html's handleSaveTemplate()) pulled forward into the data layer
 * rather than left for R5's UI to (re-)implement on its own. Rationale:
 * rebuild/ROADMAP.md's R5 section calls this out as "a real, hard-won fix"
 * (a template missing `category`/`assetClasses` crashes renderNav() for
 * every signed-in user, not just whoever saved the bad template) and
 * explicitly warns not to assume TypeScript's static types cover it, since
 * the JSON arrives as a runtime string a user pastes into a form. Putting
 * the guard here, in createTemplate/updateTemplate themselves, means it's
 * structurally impossible for any future caller (R5's UI, or anything
 * else) to persist an invalid template -- stronger than a UI-only check.
 */

const REQUIRED_TEMPLATE_FIELDS: Array<[keyof ProductNoteData, (v: unknown) => boolean]> = [
  ['category', (v) => typeof v === 'string' && v.length > 0],
  ['assetClasses', (v) => Array.isArray(v)],
  ['code', (v) => typeof v === 'string'],
  ['name', (v) => typeof v === 'string'],
]

export class InvalidTemplateDataError extends Error {
  missingFields: string[]
  constructor(missingFields: string[]) {
    super(
      `Template data is missing or has the wrong type for required field(s): ${missingFields.join(', ')}. ` +
        `These fields are read unconditionally elsewhere in the app, so a template missing them would ` +
        `break the app for every signed-in user as soon as a product is created from it.`,
    )
    this.name = 'InvalidTemplateDataError'
    this.missingFields = missingFields
  }
}

/** Throws InvalidTemplateDataError if `data` is missing any field the rest of the app dereferences unconditionally. */
export function validateTemplateData(data: unknown): asserts data is ProductNoteData {
  if (typeof data !== 'object' || data === null) {
    throw new InvalidTemplateDataError(['(entire structure is not a JSON object)'])
  }
  const record = data as Record<string, unknown>
  const missing = REQUIRED_TEMPLATE_FIELDS.filter(([field, check]) => !check(record[field])).map(
    ([field]) => field,
  )
  if (missing.length) {
    throw new InvalidTemplateDataError(missing)
  }
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await sb.from('templates').select('*').order('id')
  if (error) throw error
  return (data ?? []) as TemplateRow[]
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const { data, error } = await sb.from('templates').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as TemplateRow | null
}

export async function createTemplate(input: {
  id: string
  name: string
  description: string | null
  archetype: Archetype
  data: unknown
}): Promise<void> {
  validateTemplateData(input.data)
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { error } = await sb.from('templates').insert({
    id: input.id,
    name: input.name,
    description: input.description,
    archetype: input.archetype,
    data: input.data,
    updated_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function updateTemplate(
  id: string,
  patch: { name: string; description: string | null; archetype: Archetype; data: unknown },
): Promise<void> {
  validateTemplateData(patch.data)
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { error } = await sb
    .from('templates')
    .update({
      name: patch.name,
      description: patch.description,
      archetype: patch.archetype,
      data: patch.data,
      updated_by: user?.id ?? null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await sb.from('templates').delete().eq('id', id)
  if (error) throw error
}
