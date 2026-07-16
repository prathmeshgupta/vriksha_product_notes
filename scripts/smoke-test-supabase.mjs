// R0 smoke test: confirm the Supabase client can reach the real project and
// execute a query successfully. Not a real data-access-layer test (that's
// R2) -- just proves the URL/key/network path works before building
// anything on top of it.
//
// Expected result when run anonymously (no login): the query succeeds with
// ZERO rows, not an error. This is correct, not a bug -- the `products`
// table's RLS policy only grants SELECT to the `authenticated` role
// (verified via the Supabase project directly), so an anonymous client
// connecting successfully but seeing no rows is exactly what a properly
// locked-down table should do. Seeing real product rows requires a logged-in
// session, which is what R2 (data layer + auth) builds.
//
// Usage: node scripts/smoke-test-supabase.mjs
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    }),
)

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

console.log('Connecting to:', url)

const sb = createClient(url, key)

const { data, error } = await sb.from('products').select('id, code, name').limit(1)

if (error) {
  console.error('Supabase query failed:', error.message)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.log(
    'Supabase smoke test PASSED (connection + query executed with no error). ' +
      'Zero rows returned, which is expected for an anonymous, unauthenticated ' +
      'client -- the products table\'s RLS policy only allows SELECT for ' +
      'logged-in users. Real data will appear once R2 adds a login flow.',
  )
  process.exit(0)
}

console.log('Supabase smoke test PASSED. Sample row:', data[0])
