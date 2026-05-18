/** Session-scoped TTFF markers (high-resolution); not stored in Zustand to avoid render churn. */

let playbackIntentAt: number | null = null
let ttffCaptured = false

export function markPlaybackIntent(): void {
  if (typeof performance === "undefined") return
  playbackIntentAt = performance.now()
  ttffCaptured = false
}

export function captureTtffOnce(): number | null {
  if (typeof performance === "undefined") return null
  if (ttffCaptured || playbackIntentAt === null) return null
  ttffCaptured = true
  return Math.round(performance.now() - playbackIntentAt)
}

export function resetTelemetrySession(): void {
  playbackIntentAt = null
  ttffCaptured = false
}
