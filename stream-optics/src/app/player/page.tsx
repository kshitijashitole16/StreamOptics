"use client"

import { useState } from "react"
import { VideoPlayer } from "@/src/components/player/VideoPlayer"

const HLS_TEST_URL =
  "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8"

const DASH_TEST_URL =
  "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd"

export default function PlayerPage() {
  const [streamUrl, setStreamUrl] = useState(HLS_TEST_URL)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4 py-10 md:px-8">
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setStreamUrl(HLS_TEST_URL)}
          className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Load HLS test (Tears of Steel)
        </button>
        <button
          type="button"
          onClick={() => setStreamUrl(DASH_TEST_URL)}
          className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Load DASH test (Angel One)
        </button>
      </div>

      <div className="w-full max-w-5xl">
        <VideoPlayer streamUrl={streamUrl} />
      </div>
    </main>
  )
}
