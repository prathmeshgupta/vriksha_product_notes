import { useAuth } from './hooks/useAuth'
import { BootLoadingScreen, BootErrorScreen } from './features/auth/BootScreen'
import { LoginScreen } from './features/auth/LoginScreen'
import { AppShell } from './features/products/AppShell'
import { DevComponentsPage } from './design-system/DevComponentsPage'

/**
 * Top-level shell. As of R3: real Supabase auth gates the real product-note
 * app (AppShell) -- product list, view/edit/publish/version-history/archive.
 * R2's AuthenticatedPlaceholder verification screen has been fully replaced.
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
  return <AppShell user={user} onSignOut={signOut} />
}

export default App
