import { Button } from '../../design-system'
import './LoginScreen.css'

/**
 * Shown while `useAuth`'s status is 'loading'. Matches the frozen app's
 * #bootLoading spinner exactly (repo root index.html).
 */
export function BootLoadingScreen() {
  return (
    <div className="boot-loading">
      <div className="boot-spinner" />
      <div>Starting Vriksha Product Note Studio…</div>
    </div>
  )
}

/**
 * Shown when `useAuth`'s status is 'boot-error' -- the auth listener never
 * fired within the timeout window. See useAuth.ts's doc comment for why
 * this exists (repro'd a real production incident, not a hypothetical).
 * Matches the frozen app's #bootError block.
 */
export function BootErrorScreen({ message }: { message: string }) {
  return (
    <div className="boot-wrap">
      <div className="boot-card">
        <div className="boot-title">Couldn't load the app</div>
        <div className="boot-message">{message}</div>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    </div>
  )
}
