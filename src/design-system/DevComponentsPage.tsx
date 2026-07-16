import { useState } from 'react'
import {
  Button,
  Card,
  CardTag,
  CardTitle,
  CardBody,
  StatusPill,
  Callout,
  Pill,
  TextField,
  NumberField,
  SelectField,
  TextAreaField,
} from './index'

/**
 * R1 verification page: every design-system component and variant, in one
 * place, for side-by-side visual comparison against the frozen app
 * (repo root index.html) before R1 is considered done. Not part of the
 * shipped app -- dev-only, reached via /app.html when App.tsx routes here.
 * See rebuild/ROADMAP.md R1 verification step.
 */
export function DevComponentsPage() {
  const [sleeveMin, setSleeveMin] = useState<number | null>(60)
  const [sleeveMax, setSleeveMax] = useState<number | null>(80)
  const [textVal, setTextVal] = useState('DMAERI-GOAL')
  const [notes, setNotes] = useState('')

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', color: 'var(--mist)' }}>
        Design system — R1 verification
      </h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 32 }}>
        Every component and variant below should be pixel-equivalent to the frozen app
        (repo root <code>index.html</code>). Compare side by side before marking R1 done.
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 className="mono" style={{ color: 'var(--sage)', fontSize: '0.9rem' }}>
          Button
        </h2>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="danger">Danger</Button>
          <Button size="small">Small</Button>
          <Button variant="primary" size="small">
            Primary small
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className="mono" style={{ color: 'var(--sage)', fontSize: '0.9rem' }}>
          StatusPill
        </h2>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <StatusPill kind="published" />
          <StatusPill kind="draft" />
          <StatusPill kind="compliant" />
          <StatusPill kind="non-compliant" />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className="mono" style={{ color: 'var(--sage)', fontSize: '0.9rem' }}>
          Callout
        </h2>
        <Callout>Default callout — informational, gold left border.</Callout>
        <Callout variant="warn">Warn callout — amber, e.g. a soft compliance warning.</Callout>
        <Callout variant="danger">Danger callout — red, e.g. a hard error.</Callout>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className="mono" style={{ color: 'var(--sage)', fontSize: '0.9rem' }}>
          Pill
        </h2>
        <div style={{ marginTop: 12 }}>
          <Pill>Large Cap</Pill>
          <Pill>Financials</Pill>
          <Pill>India SEBI</Pill>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className="mono" style={{ color: 'var(--sage)', fontSize: '0.9rem' }}>
          Card
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 2,
            marginTop: 12,
          }}
        >
          <Card>
            <CardTag>Goal-Based</CardTag>
            <CardTitle>Discretionary Multi-Asset ETF/REIT/InvIT Portfolio</CardTitle>
            <CardBody>By life goal × risk profile. Click-through card, hover for gold edge.</CardBody>
            <StatusPill kind="published" />
          </Card>
          <Card interactive={false}>
            <CardTag system>System</CardTag>
            <CardTitle>Static / non-interactive card</CardTitle>
            <CardBody>No hover affordance — used for pure display, e.g. summary tiles.</CardBody>
          </Card>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className="mono" style={{ color: 'var(--sage)', fontSize: '0.9rem' }}>
          Form fields
        </h2>
        <div style={{ marginTop: 12, maxWidth: 600 }}>
          <TextField label="Product Code" value={textVal} onChange={(e) => setTextVal(e.target.value)} />
          <NumberField
            label="Sleeve Min %"
            compact
            value={sleeveMin}
            onValueChange={setSleeveMin}
          />
          <NumberField
            label="Sleeve Max %"
            compact
            value={sleeveMax}
            onValueChange={setSleeveMax}
          />
          <SelectField label="Regulatory Regime" defaultValue="india_sebi">
            <option value="india_sebi">India SEBI</option>
            <option value="other">Other</option>
            <option value="none">None</option>
          </SelectField>
          <TextAreaField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note for this version..."
          />
        </div>
      </section>
    </div>
  )
}
