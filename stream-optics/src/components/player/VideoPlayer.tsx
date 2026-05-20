"use client"

import { useRef } from "react"
import { BufferingOverlay } from "@/src/components/player/BufferingOverlay"
import { Controls } from "@/src/components/player/Controls"
import { StatsPanel } from "@/src/components/player/StatsPanel"
import { useMediaEngine } from "@/src/hooks/useMediaEngine"
import { useTelemetry } from "@/src/hooks/useTelemetry"

export interface VideoPlayerProps {
  streamUrl?: string
}

export function VideoPlayer({ streamUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const resolvedUrl = streamUrl?.trim() ?? ""

  useMediaEngine({ videoRef, streamUrl: resolvedUrl })
  useTelemetry({ videoRef, streamUrl: resolvedUrl })

  return (
    <section className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] aspect-video">
        <video
          ref={videoRef}
          controls={false}
          preload="metadata"
          playsInline
          className="h-full w-full object-contain"
          aria-label="StreamOptics media player"
        />

        {!resolvedUrl ? (
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/70 px-6 text-center text-sm text-zinc-300">
            Select an HLS or DASH test stream to begin playback.
          </div>
        ) : null}

        <BufferingOverlay hasStream={Boolean(resolvedUrl)} />
        <StatsPanel />
        <Controls videoRef={videoRef} />
      </div>
    </section>
  )
}
