"use client"

import { memo } from "react"
import { useMediaStore } from "@/src/store/useMediaStore"

function formatBitrate(bps: number): string {
  if (bps <= 0) return "—"
  return `${Math.round(bps / 1000).toLocaleString("en-US")} kbps`
}

function formatStallSeconds(totalSeconds: number): string {
  return `${totalSeconds.toFixed(1)}s`
}

interface StatLineProps {
  label: string
  value: string
}

function StatLine({ label, value }: StatLineProps) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-400">{label}</span>
      <span className="tabular-nums text-zinc-100">{value}</span>
    </div>
  )
}

const ProtocolStat = memo(function ProtocolStat() {
  const activeProtocol = useMediaStore((state) => state.activeProtocol)
  return <StatLine label="Protocol" value={activeProtocol} />
})

const BitrateStat = memo(function BitrateStat() {
  const currentBitrate = useMediaStore((state) => state.currentBitrate)
  return <StatLine label="Bitrate" value={formatBitrate(currentBitrate)} />
})

const TtffStat = memo(function TtffStat() {
  const ttff = useMediaStore((state) => state.ttff)
  const value = ttff > 0 ? `${ttff} ms` : "—"
  return <StatLine label="TTFF" value={value} />
})

const BufferStat = memo(function BufferStat() {
  const bufferCount = useMediaStore((state) => state.bufferCount)
  const totalBufferDuration = useMediaStore((state) => state.totalBufferDuration)
  return (
    <StatLine
      label="Buffering"
      value={`Stalls: ${bufferCount} | Total: ${formatStallSeconds(totalBufferDuration)}`}
    />
  )
})

const PlayerStateStat = memo(function PlayerStateStat() {
  const isPlaying = useMediaStore((state) => state.isPlaying)
  const isBuffering = useMediaStore((state) => state.isBuffering)

  let playerState = "Paused"
  if (isBuffering) playerState = "Buffering"
  else if (isPlaying) playerState = "Playing"

  return <StatLine label="State" value={playerState} />
})

const StatsPanelBody = memo(function StatsPanelBody() {
  return (
    <div
      className="pointer-events-none absolute left-3 top-3 z-[15] max-w-[min(100%,20rem)] rounded-lg border border-white/15 bg-slate-900/80 p-3 font-mono text-xs text-zinc-100 shadow-lg backdrop-blur-sm md:left-4 md:top-4"
      aria-live="polite"
      aria-label="Stats for Nerds"
    >
      <p className="mb-2 border-b border-white/10 pb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
        Stats for Nerds
      </p>
      <div className="flex flex-col gap-1.5">
        <ProtocolStat />
        <BitrateStat />
        <TtffStat />
        <BufferStat />
        <PlayerStateStat />
      </div>
    </div>
  )
})

function StatsPanelVisibilityGate() {
  const showStatsPanel = useMediaStore((state) => state.showStatsPanel)
  if (!showStatsPanel) return null
  return <StatsPanelBody />
}

export const StatsPanel = memo(StatsPanelVisibilityGate)
