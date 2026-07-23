import { useEffect, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import type { ProductRow, TemplateRow } from '../../data/types'
import { listTemplates } from '../../data/templates'
import { createBlankProduct, createProductFromExisting, createProductFromJson, createProductFromTemplate } from '../../data/products'
import { getErrorMessage } from '../../lib/errors'
import { Button, Callout, SelectField, TextAreaField, TextField } from '../../design-system'
import './products.css'

export interface CreateProductViewProps {
  products: ProductRow[]
  onCreated: (id: string) => void
  onCancel: () => void
  onManageTemplates: () => void
}

type CreatePath = 'blank' | 'template' | 'existing' | 'json'

const BLANK_JSON_PLACEHOLDER = JSON.stringify(
  {
    code: 'NEW-CODE',
    name: 'New Product Name',
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
    styleSleeves: [],
  },
  null,
  2,
)

/**
 * R5's three-path Create screen (blank / from archetype template / from
 * existing product), ported from the frozen app's renderCreateView() (repo
 * root index.html) -- same three paths, same "Create & Open for Editing"
 * outcome. Plus a 4th path, "Import from JSON" (R5.5, not in the frozen
 * app), added per the user's explicit request to prioritize bulk product
 * creation from a JSON template that can be filled out manually or via an
 * LLM and re-uploaded, rather than only ever entering content field-by-field
 * in ProductEditor.tsx. All four paths funnel through the same
 * data/products.ts create* functions and land in the editor on success,
 * matching the frozen app's handleCreateProduct() -> showEdit(newId).
 */
export function CreateProductView({ products, onCreated, onCancel, onManageTemplates }: CreateProductViewProps) {
  const [path, setPath] = useState<CreatePath>('blank')
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null)
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [existingId, setExistingId] = useState(products[0]?.id ?? '')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listTemplates()
      .then((t) => {
        if (cancelled) return
        setTemplates(t)
        const first = t[0]
        if (first && !templateId) setTemplateId(first.id)
      })
      .catch((err: unknown) => {
        if (!cancelled) setTemplateLoadError(getErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedTemplate = (templates ?? []).find((t) => t.id === templateId) ?? null

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    saveAs(blob, filename)
  }

  function handleJsonFile(file: File | null | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setJsonText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function handleCreate() {
    setCreateError(null)
    if (path !== 'json' && !name.trim()) {
      setCreateError('Please enter a name for the new product.')
      return
    }
    setCreating(true)
    try {
      let newId: string
      if (path === 'blank') {
        newId = await createBlankProduct(name.trim(), code.trim() || undefined)
      } else if (path === 'template') {
        if (!templateId) throw new Error('No template selected.')
        newId = await createProductFromTemplate(templateId, name.trim(), code.trim() || undefined)
      } else if (path === 'existing') {
        if (!existingId) throw new Error('No source product selected.')
        newId = await createProductFromExisting(existingId, name.trim(), code.trim() || undefined)
      } else {
        let parsed: unknown
        try {
          parsed = JSON.parse(jsonText)
        } catch (err) {
          throw new Error('Not valid JSON: ' + (getErrorMessage(err)))
        }
        newId = await createProductFromJson(parsed, name.trim(), code.trim() || undefined)
      }
      onCreated(newId)
    } catch (err) {
      setCreateError(getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  function tabButton(p: CreatePath, label: string) {
    return (
      <Button variant={path === p ? 'primary' : 'default'} onClick={() => setPath(p)}>
        {label}
      </Button>
    )
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>New Product Note</h1>
          <div className="topbar-sub">Choose how to start — blank, from an archetype template, copied from an existing product, or imported from JSON</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          {tabButton('blank', 'Start Blank')}
          {tabButton('template', 'From Archetype Template')}
          {tabButton('existing', 'From Existing Product')}
          {tabButton('json', 'Import from JSON')}
        </div>
      </div>

      <div className="card">
        {path === 'blank' && (
          <Callout>
            Starts from an empty product with no pre-filled sleeves, variants, or allocation ranges. Use this when
            the product doesn&apos;t match any existing archetype and you want to build the structure yourself in
            the editor.
          </Callout>
        )}

        {path === 'template' && (
          <>
            <Callout>
              Starts from a clean archetype structure — style-sleeve equity, strategic allocation, risk-profiled
              variants, or goal-based glide path — with placeholder text, not real client content. Manage the
              available archetypes from{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  onManageTemplates()
                }}
              >
                Manage Templates
              </a>
              .
            </Callout>
            {templateLoadError && <Callout variant="danger">Failed to load templates: {templateLoadError}</Callout>}
            {templates !== null && templates.length === 0 && (
              <Callout variant="warn">
                No archetype templates exist yet.{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onManageTemplates()
                  }}
                >
                  Create one in Manage Templates
                </a>{' '}
                first, or use &quot;Start Blank&quot; instead.
              </Callout>
            )}
            {templates !== null && templates.length > 0 && (
              <>
                <SelectField label="Archetype Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectField>
                {selectedTemplate?.description && <Callout>{selectedTemplate.description}</Callout>}
                <div style={{ marginTop: -4, marginBottom: 12 }}>
                  <Button
                    size="small"
                    onClick={() => selectedTemplate && downloadJson(`${selectedTemplate.id}_template.json`, selectedTemplate.data)}
                  >
                    ⬇ Download this template&apos;s JSON
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {path === 'existing' && (
          <>
            <Callout>
              Full copy of a live product&apos;s actual content (objective, philosophy, allocation, risk text —
              everything), given a new ID. Use this when you&apos;re building a close variant of something that
              already exists, not a fresh archetype.
            </Callout>
            <SelectField label="Copy From" value={existingId} onChange={(e) => setExistingId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.name} ({p.category})
                </option>
              ))}
            </SelectField>
          </>
        )}

        {path === 'json' && (
          <>
            <Callout>
              Paste or upload a full product-note JSON (same field shape as a template&apos;s structure —{' '}
              <code>code</code>, <code>name</code>, <code>category</code>, <code>assetClasses</code>, plus{' '}
              <code>styleSleeves</code>/<code>variants</code>/<code>strategicAllocationRanges</code>/
              <code>goalFramework</code> depending on archetype). Fill it out by hand or hand it to an LLM to draft,
              then upload here — this is the bulk-creation path for standing up a strategy without entering every
              field one at a time in the editor. Name/Code below are optional overrides; if left blank, the values
              already in the JSON are used.
            </Callout>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <Button size="small" onClick={() => fileInputRef.current?.click()}>
                Upload .json file
              </Button>
              <Button size="small" onClick={() => downloadJson('blank_product_template.json', JSON.parse(BLANK_JSON_PLACEHOLDER))}>
                ⬇ Download blank JSON template
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => handleJsonFile(e.target.files?.[0])}
            />
            <TextAreaField
              label="Product JSON"
              rows={14}
              value={jsonText}
              placeholder={BLANK_JSON_PLACEHOLDER}
              style={{ fontFamily: 'monospace', fontSize: '12.5px' }}
              onChange={(e) => setJsonText(e.target.value)}
            />
          </>
        )}

        {path !== 'json' && (
          <>
            <TextField
              label="New Product Name"
              value={name}
              placeholder="e.g. Discretionary Multi-Asset Portfolio — Aggressive Growth Variant"
              onChange={(e) => setName(e.target.value)}
            />
            <TextField label="New Product Code" value={code} placeholder="e.g. DMAP-AGV" onChange={(e) => setCode(e.target.value)} />
          </>
        )}

        {path === 'json' && (
          <>
            <TextField label="New Product Name (optional override)" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="New Product Code (optional override)" value={code} onChange={(e) => setCode(e.target.value)} />
          </>
        )}

        {createError && <Callout variant="danger">Failed to create product: {createError}</Callout>}

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <Button
            variant="primary"
            disabled={creating || (path === 'template' && (templates === null || templates.length === 0))}
            onClick={handleCreate}
          >
            {creating ? 'Creating…' : 'Create & Open for Editing'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
