import { useAuth } from './hooks/useAuth'
import { BootLoadingScreen, BootErrorScreen } from './features/auth/BootScreen'
import { LoginScreen } from './features/auth/LoginScreen'
import { AuthenticatedPlaceholder } from './features/auth/AuthenticatedPlaceholder'
import { DevComponentsPage } from './design-system/DevComponentsPage'

/**
 * Top-level shell. As of R2: real Supabase auth gates a placeholder
 * authenticated screen that proves real data loads (see
 * AuthenticatedPlaceholder's doc comment). Real product nav/routing
 * replaces that placeholder in R3 -- see rebuild/ROADMAP.md.
 *
 * The R1 design-system verification page is still reachable at
 * /app.html?components for regression-checking future component changes
 * against the frozen app, without it being in the way of the real app flow.
 */
function App() {
  const { status, user, bootErrorMessage, signIn, signOut } = useAuth()

  const showComponentsDemo =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('components')

  if (showComponentsDemo) {
    return <DevComponentsPage />
  }

  if (status === 'loading') {
    return <BootLoadingScreen />
  }

  if (status === 'boot-error') {
    return <BootErrorScreen message={bootErrorMessage ?? 'Unknown error.'} />
  }

  if (status === 'unauthenticated') {
    return <LoginScreen onSignIn={signIn} />
  }

  // status === 'authenticated'. useAuth sets `user` and `status` together in
  // the same onAuthStateChange callback (batched into one render), so this
  // should never actually be null here -- but avoiding a non-null assertion
  // in favor of an explicit fallback keeps that guarantee enforced by the
  // type checker rather than by convention.
  if (!user) {
    return <BootLoadingScreen />
  }
  return <AuthenticatedPlaceholder user={user} onSignOut={signOut} />
}

export default App
