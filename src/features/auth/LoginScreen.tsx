import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../design-system'
import '../../design-system/form/fields.css'
import './LoginScreen.css'

export interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<{ ok: boolean; errorMessage?: string }>
}

/**
 * Matches the frozen app's login screen exactly (see repo root index.html,
 * #loginScreen / .login-card). Accounts are created manually by an
 * administrator -- no self-signup flow, same as the frozen app.
 */
export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(evt: FormEvent) {
    evt.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Enter both email and password.')
      return
    }

    setSubmitting(true)
    try {
      const result = await onSignIn(email.trim(), password)
      if (!result.ok) {
        setError(result.errorMessage ?? 'Invalid email or password.')
      }
      // On success, the parent's auth state flips and this screen unmounts.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">Vriksha</div>
        <div className="login-sub">// product note studio — sign in</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="loginEmail">
              Email
            </label>
            <input
              type="text"
              id="loginEmail"
              autoComplete="username"
              placeholder="you@vriksha.example"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="loginPassword">
              Password
            </label>
            <input
              type="password"
              id="loginPassword"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" className="login-btn" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <div className="login-foot">
          Accounts are created manually by an administrator. If you don't have credentials, contact
          whoever manages this studio.
        </div>
      </div>
    </div>
  )
}
