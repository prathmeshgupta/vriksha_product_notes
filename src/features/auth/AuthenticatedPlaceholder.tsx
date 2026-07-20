import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Button, Card, CardTitle, CardBody, StatusPill, Callout } from '../../design-system'
import { listProducts } from '../../data/products'
import type { ProductRow } from '../../data/types'

export interface AuthenticatedPlaceholderProps {
  user: User
  onSignOut: () => void
}

/**
 * R2 verification screen: proves the full loop works end to end -- logged
 * in, real Supabase read, typed data rendered. This is NOT the real product
 * nav/routing (that's R3's job, see rebuild/ROADMAP.md) -- just enough to
 * satisfy R2's "can read the real 9+ products from the real database"
 * verification step without faking it.
 */
export function AuthenticatedPlaceholder({ user, onSignOut }: AuthenticatedPlaceholderProps) {
  const [products, setProducts] = useState<ProductRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listProducts({ includeArchived: true })
      .then((rows) => {
        if (!cancelled) setProducts(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleSignOutClick() {
    if (window.confirm('Sign out of Vriksha Product Note Studio?')) {
      onSignOut()
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', color: 'var(--mist)' }}>Signed in</h1>
        <Button onClick={handleSignOutClick}>Sign out</Button>
      </div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24 }} className="mono">
        {user.email}
      </p>

      {error && <Callout variant="danger">Failed to load products: {error}</Callout>}

      {products === null && !error && <p style={{ color: 'var(--text-dim)' }}>Loading products…</p>}

      {products !== null && (
        <>
          <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
            {products.length} product{products.length === 1 ? '' : 's'} loaded from Supabase (real data,
            R2 verification).
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 2,
            }}
          >
            {products.map((p) => (
              <Card key={p.id} interactive={false}>
                <CardTitle>
                  {p.code} — {p.name}
                </CardTitle>
                <CardBody>{p.category}</CardBody>
                <StatusPill kind={p.status} />
                {p.archived && (
                  <span style={{ marginLeft: 8 }}>
                    <StatusPill kind="draft">Archived</StatusPill>
                  </span>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
