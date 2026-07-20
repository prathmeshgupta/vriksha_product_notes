import { useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { sb } from '../data/supabaseClient'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'boot-error'

export interface AuthState {
  status: AuthStatus
  user: User | null
  session: Session | null
  /** Only set when status === 'boot-error'. */
  bootErrorMessage: string | null
}

export interface SignInResult {
  ok: boolean
  errorMessage?: string
}

const BOOT_TIMEOUT_MS = 8000

/**
 * Auth state, driven entirely off `onAuthStateChange` -- this is the exact
 * pattern the frozen app uses (see repo root index.html, and
 * PROJECT_HISTORY.md's "infinite loading spinner" incident, task #30).
 *
 * Critically, this hook replicates the frozen app's fix for that incident:
 * relying on a single library callback with zero fallback caused the app to
 * hang on a loading spinner forever if the callback didn't fire (slow
 * network, blocked CDN, transient Supabase issue, unexpected SDK behavior).
 * The fix was an 8-second timeout that surfaces a clear error instead of
 * spinning indefinitely -- ported here as `bootTimedOut` -> 'boot-error'
 * status. Do not remove this timeout under the assumption that
 * onAuthStateChange "always fires" -- it didn't, once, in production.
 */
export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
} {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [bootErrorMessage, setBootErrorMessage] = useState<string | null>(null)
  const authEventFired = useRef(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, newSession) => {
      authEventFired.current = true
      if (newSession && newSession.user) {
        setSession(newSession)
        setUser(newSession.user)
        setStatus('authenticated')
      } else {
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
      }
    })

    const bootTimeout = setTimeout(() => {
      if (!authEventFired.current) {
        setStatus('boot-error')
        setBootErrorMessage(
          `The app is taking longer than expected to start (no response from Supabase after ${
            BOOT_TIMEOUT_MS / 1000
          } seconds). This usually means a slow or blocked network connection.`,
        )
      }
    }, BOOT_TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      clearTimeout(bootTimeout)
    }
  }, [])

  async function signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      return { ok: false, errorMessage: error.message || 'Invalid email or password.' }
    }
    // onAuthStateChange picks up the new session and flips status to 'authenticated'.
    return { ok: true }
  }

  async function signOut(): Promise<void> {
    await sb.auth.signOut()
    // onAuthStateChange handles the transition back to 'unauthenticated'.
  }

  return { status, user, session, bootErrorMessage, signIn, signOut }
}
