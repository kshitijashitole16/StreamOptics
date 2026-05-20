"use client"

import { memo } from "react"
import { useMediaStore } from "@/src/store/useMediaStore"

interface BufferingOverlayProps {
  hasStream: boolean
}

function BufferingSpinner() {
  return (
    <div
      className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
      aria-hidden="true"
    />
  )
}

function BufferingOverlayContent({ hasStream }: BufferingOverlayProps) {
  const isBuffering = useMediaStore((state) => state.isBuffering)

  if (!hasStream || !isBuffering) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[8] flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Buffering video"
    >
      <BufferingSpinner />
      <span className="text-sm font-medium tracking-wide text-zinc-200">Buffering…</span>
    </div>
  )
}

export const BufferingOverlay = memo(BufferingOverlayContent)
