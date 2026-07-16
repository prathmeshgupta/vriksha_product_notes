import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Expected VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY to be set (see .env.example). This mirrors the ' +
      'frozen app\'s hardcoded-key pattern but reads from Vite env vars instead ' +
      '— see rebuild/ARCHITECTURE.md for the reasoning.',
  )
}

// Named `sb` to match the frozen app's variable name, which exists there
// specifically to avoid a `window.supabase` naming collision bug (see
// repo-root PROJECT_HISTORY.md). Keeping the same name here for consistency
// when cross-referencing the two codebases, even though the collision risk
// itself does not apply in a modules-based build.
export const sb = createClient(supabaseUrl, supabaseAnonKey)
