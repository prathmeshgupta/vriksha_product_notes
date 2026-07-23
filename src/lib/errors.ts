/**
 * Extracts a human-readable message from a caught value of unknown shape.
 *
 * Every screen in this app used to inline `err instanceof Error ? err.message
 * : String(err)` in its catch handlers (~23 call sites across 11 files).
 * That works for real `Error` instances (thrown JS errors, `new Error(...)`)
 * but Supabase's `PostgrestError`/`AuthError` -- what `data/*.ts`'s `throw
 * error` actually throws on most Supabase call failures -- are plain
 * objects (`{ message, details, hint, code }`), not `Error` instances. For
 * those, `String(err)` falls through to `Object.prototype.toString`, which
 * is the literal string "[object Object]" -- silently hiding the real
 * error from the user at every one of those 23 sites, not just whichever
 * one happens to surface first. Found via a real "Failed to load products:
 * [object Object]" report right after a fresh `npm run dev`.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
