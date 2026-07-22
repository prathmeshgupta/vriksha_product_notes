import { useEffect, useState } from 'react'
import type { Archetype, TemplateRow } from '../../data/types'
import {
  InvalidTemplateDataError,
  createTemplate,
  deleteTemplate,
  getNextTemplateId,
  listTemplates,
  updateTemplate,
} from '../../data/templates'
import { Button, Callout, Card, CardBody, CardTag, CardTitle, SelectField, TextAreaField, TextField } from '../../design-system'
import './products.css'

const ARCHETYPE_OPTIONS: Archetype[] = ['single-sleeve', 'strategic-allocation', 'risk-variant', 'goal-based']

const BLANK_TEMPLATE_DATA_PLACEHOLDER = JSON.stringify(
  {
    code: 'NEW-CODE',
    name: 'New Template Product',
    shortName: 'Short name',
    category: 'Discretionary — Single Asset Class (Equity)',
    assetClasses: [],
    objective: '',
    philosophy: '',
    benchmark: '',
    rebalanceFrequency: '',
    riskProfile: '',
    suitability: '',
    minInvestment: '',
    fees: '',
    taxNote: '',
    keyRisks: [],
  },
  null,
  2,
)

/**
 * Manage Templates -- ported from the frozen app's renderTemplatesView()/
 * renderTemplateEditor()/handleSaveTemplate()/handleDeleteTemplate() (repo
 * root index.html). Templates hold placeholder structure only, never real
 * client content; editing/deleting one has no effect on any product already
 * created from it (the clone happens once, at creation time, in
 * data/products.ts's createProductFromTemplate()).
 *
 * The shape-validation guard the frozen app ran inline inside
 * handleSaveTemplate() now lives in data/templates.ts's
 * validateTemplateData() (called by createTemplate/updateTemplate
 * themselves, per that file's own comment) -- this component just catches
 * InvalidTemplateDataError and surfaces its message, it doesn't re-implement
 * the check.
 */
export function ManageTemplatesView() {
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null) // null = list view; '__new__' = creating
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [archetype, setArchetype] = useState<Archetype>('single-sleeve')
  const [dataText, setDataText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function refresh() {
    setLoadError(null)
    listTemplates()
      .then(setTemplates)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(() => {
    refresh()
  }, [])

  function startNew() {
    setEditingId('__new__')
    setName('')
    setDescription('')
    setArchetype('single-sleeve')
    setDataText(BLANK_TEMPLATE_DATA_PLACEHOLDER)
    setSaveError(null)
  }

  function startEdit(t: TemplateRow) {
    setEditingId(t.id)
    setName(t.name)
    setDescription(t.description || '')
    setArchetype(t.archetype)
    setDataText(JSON.stringify(t.data, null, 2))
    setSaveError(null)
  }

  async function handleDelete(t: TemplateRow) {
    if (!window.confirm(`Delete template "${t.name}"? This does not affect any product already created from it.`)) return
    try {
      await deleteTemplate(t.id)
      refresh()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSave() {
    setSaveError(null)
    if (!name.trim()) {
      setSaveError('Please enter a template name.')
      return
    }
    let parsedData: unknown
    try {
      parsedData = JSON.parse(dataText)
    } catch (err) {
      setSaveError('Structure field is not valid JSON: ' + (err instanceof Error ? err.message : String(err)))
      return
    }
    setSaving(true)
    try {
      const isNew = editingId === '__new__'
      if (isNew) {
        const id = await getNextTemplateId()
        await createTemplate({ id, name: name.trim(), description: description.trim() || null, archetype, data: parsedData })
      } else if (editingId) {
        await updateTemplate(editingId, { name: name.trim(), description: description.trim() || null, archetype, data: parsedData })
      }
      setEditingId(null)
      refresh()
    } catch (err) {
      if (err instanceof InvalidTemplateDataError) {
        setSaveError(
          `${err.message} Add at least: category (string), assetClasses (array), code (string), name (string).`,
        )
      } else {
        setSaveError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setSaving(false)
    }
  }

  if (editingId !== null) {
    const isNew = editingId === '__new__'
    return (
      <div>
        <div className="topbar">
          <div>
            <h1>{isNew ? 'New Template' : `Edit Template — ${name}`}</h1>
            <div className="topbar-sub">Structure only — no real client content</div>
          </div>
        </div>
        <div className="card">
          <TextField label="Template Name" value={name} placeholder="e.g. Single-Sleeve Equity" onChange={(e) => setName(e.target.value)} />
          <TextAreaField
            label="Description"
            rows={2}
            value={description}
            placeholder="Shown to users choosing this template on the Create screen"
            onChange={(e) => setDescription(e.target.value)}
          />
          <SelectField label="Archetype Tag" value={archetype} onChange={(e) => setArchetype(e.target.value as Archetype)}>
            {ARCHETYPE_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label="Structure (JSON)"
            rows={18}
            value={dataText}
            style={{ fontFamily: 'monospace', fontSize: '12.5px' }}
            onChange={(e) => setDataText(e.target.value)}
          />
          <div className="topbar-sub" style={{ marginTop: 6 }}>
            Same field shape as a product&apos;s data (e.g. <code>styleSleeves</code>, <code>variants</code>,{' '}
            <code>portfolioConstructionRules</code>). Must be valid JSON.
          </div>

          {saveError && <Callout variant="danger">{saveError}</Callout>}

          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <Button variant="primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save Template'}
            </Button>
            <Button onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Manage Templates</h1>
          <div className="topbar-sub">
            Archetype starting structures used by &quot;New Product → From Archetype Template.&quot; Kept separate
            from live products.
          </div>
        </div>
        <div className="toolbar">
          <Button variant="primary" onClick={startNew}>
            + New Template
          </Button>
        </div>
      </div>
      <Callout>
        Templates hold placeholder structure only — never real client content. Editing or deleting a template has
        no effect on any already-created product; the clone happens once, at creation time.
      </Callout>
      {loadError && <Callout variant="danger">Failed to load templates: {loadError}</Callout>}
      {templates === null && !loadError && <p style={{ color: 'var(--text-dim)' }}>Loading templates…</p>}
      {templates !== null && templates.length === 0 && (
        <Callout>No templates yet. Click &quot;+ New Template&quot; to create the first one.</Callout>
      )}
      {templates !== null && templates.length > 0 && (
        <div className="grid-overview">
          {templates.map((t) => (
            <Card key={t.id} interactive={false}>
              <CardTag>{t.archetype}</CardTag>
              <CardTitle>{t.name}</CardTitle>
              <CardBody>{(t.description || '').slice(0, 160)}</CardBody>
              <div className="toolbar" style={{ marginTop: 10 }}>
                <Button size="small" onClick={() => startEdit(t)}>
                  Edit
                </Button>
                <Button size="small" variant="danger" onClick={() => handleDelete(t)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
