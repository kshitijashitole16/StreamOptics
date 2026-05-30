"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type {
  SessionSummary,
  TelemetryAggregateResponse,
  TelemetryTimelinePoint,
  TelemetryTimelineResponse,
} from "@/src/shared/telemetry"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:4000"

interface MetricCardProps {
  label: string
  value: string
  note: string
}

function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <article className="rounded-xl border border-white/12 bg-black/30 p-4 backdrop-blur-sm">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{note}</p>
    </article>
  )
}

function MetricCardSkeleton() {
  return (
    <article className="animate-pulse rounded-xl border border-white/12 bg-black/30 p-4">
      <div className="h-3 w-28 rounded bg-zinc-700/60" />
      <div className="mt-3 h-8 w-24 rounded bg-zinc-700/60" />
      <div className="mt-2 h-3 w-40 rounded bg-zinc-700/60" />
    </article>
  )
}

interface ChartShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

function ChartShell({ title, subtitle, children }: ChartShellProps) {
  return (
    <section className="rounded-xl border border-white/12 bg-black/30 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="text-xs text-zinc-400">{subtitle}</p>
      <div className="mt-4 h-64 w-full">{children}</div>
    </section>
  )
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full animate-pulse rounded-lg bg-zinc-800/60" />
  )
}

function formatTimeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatBitrate(bitrate: number): string {
  if (bitrate <= 0) return "0 kbps"
  return `${Math.round(bitrate / 1000).toLocaleString("en-US")} kbps`
}

function formatBufferRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

function buildTimelineDataset(points: TelemetryTimelinePoint[]) {
  return points.map((point) => ({
    ...point,
    timestampLabel: formatTimeLabel(point.timestamp),
    bitrateKbps: Number((point.currentBitrate / 1000).toFixed(2)),
    bufferDepth: Number(point.forwardBufferLength.toFixed(2)),
  }))
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>("")
  const [aggregate, setAggregate] = useState<TelemetryAggregateResponse | null>(null)
  const [timeline, setTimeline] = useState<TelemetryTimelineResponse | null>(null)
  const [isSessionsLoading, setIsSessionsLoading] = useState(true)
  const [isMetricsLoading, setIsMetricsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    let active = true

    const fetchSessions = async () => {
      setIsSessionsLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/sessions`)
        if (!response.ok) throw new Error(`Failed to load sessions (${response.status})`)
        const payload = (await response.json()) as SessionSummary[]
        if (!active) return
        setSessions(payload)
        if (!selectedSessionId && payload[0]) {
          setSelectedSessionId(payload[0].sessionId)
        }
      } catch (error) {
        if (!active) return
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load telemetry sessions",
        )
      } finally {
        if (!active) return
        setIsSessionsLoading(false)
      }
    }

    void fetchSessions()
    return () => {
      active = false
    }
  }, [selectedSessionId])

  useEffect(() => {
    let active = true
    if (!selectedSessionId) {
      setAggregate(null)
      setTimeline(null)
      setIsMetricsLoading(false)
      return undefined
    }

    const fetchSessionDetails = async () => {
      setIsMetricsLoading(true)
      setErrorMessage("")
      try {
        const [aggregateResponse, timelineResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/sessions/${selectedSessionId}/aggregate`),
          fetch(`${API_BASE_URL}/api/sessions/${selectedSessionId}/timeline`),
        ])

        if (!aggregateResponse.ok) {
          throw new Error(`Failed to load aggregate data (${aggregateResponse.status})`)
        }
        if (!timelineResponse.ok) {
          throw new Error(`Failed to load timeline data (${timelineResponse.status})`)
        }

        const [aggregatePayload, timelinePayload] = (await Promise.all([
          aggregateResponse.json(),
          timelineResponse.json(),
        ])) as [TelemetryAggregateResponse, TelemetryTimelineResponse]

        if (!active) return
        setAggregate(aggregatePayload)
        setTimeline(timelinePayload)
      } catch (error) {
        if (!active) return
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load session analytics",
        )
      } finally {
        if (!active) return
        setIsMetricsLoading(false)
      }
    }

    void fetchSessionDetails()
    return () => {
      active = false
    }
  }, [selectedSessionId])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  )

  const chartData = useMemo(
    () => buildTimelineDataset(timeline?.points ?? []),
    [timeline?.points],
  )

  return (
    <main className="min-h-screen bg-[#070c17] px-4 py-8 text-zinc-100 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-xl border border-cyan-200/15 bg-black/35 p-5 backdrop-blur-sm">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-200/70">
            StreamOptics Analytics
          </p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-semibold md:text-3xl">QoS Analytics Hub</h1>
            <label className="flex flex-col gap-1 text-sm text-zinc-300 md:w-96">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Session</span>
              <select
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                className="rounded-lg border border-white/15 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60"
                disabled={isSessionsLoading || sessions.length === 0}
              >
                {!sessions.length ? <option value="">No sessions available</option> : null}
                {sessions.map((session) => (
                  <option key={session.sessionId} value={session.sessionId}>
                    {session.protocol} · {new Date(session.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedSession ? (
            <p className="mt-3 truncate text-xs text-zinc-400">Stream URL: {selectedSession.streamUrl}</p>
          ) : null}
        </header>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {isMetricsLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                label="Time To First Frame"
                value={aggregate ? `${aggregate.ttff} ms` : "—"}
                note="Startup latency from play intent to first rendered frame"
              />
              <MetricCard
                label="Total Stall Events"
                value={aggregate ? String(aggregate.totalStallCount) : "—"}
                note="Number of buffering interruptions in this session"
              />
              <MetricCard
                label="Average Buffering Ratio"
                value={aggregate ? formatBufferRatio(aggregate.averageBufferingRatio) : "—"}
                note="Total stall time divided by observed session duration"
              />
            </>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartShell
            title="Bitrate Timeline"
            subtitle="Adaptive bitrate transitions over session time"
          >
            {isMetricsLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#233148" />
                  <XAxis
                    dataKey="timestampLabel"
                    tick={{ fill: "#8ea4c9", fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "#8ea4c9", fontSize: 12 }}
                    tickFormatter={(value) => `${value} kbps`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#081124",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff",
                    }}
                    formatter={(value) => [`${value} kbps`, "Bitrate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="bitrateKbps"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartShell>

          <ChartShell
            title="Forward Buffer Depth"
            subtitle="Buffered seconds available ahead of current playback point"
          >
            {isMetricsLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#233148" />
                  <XAxis
                    dataKey="timestampLabel"
                    tick={{ fill: "#8ea4c9", fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "#8ea4c9", fontSize: 12 }}
                    tickFormatter={(value) => `${value}s`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#081124",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff",
                    }}
                    formatter={(value) => [`${value}s`, "Buffer depth"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="bufferDepth"
                    stroke="#60a5fa"
                    fill="#1d4ed8"
                    fillOpacity={0.35}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartShell>
        </section>

        {!isMetricsLoading && chartData.length > 0 ? (
          <footer className="rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-300">
            Final bitrate: {aggregate ? formatBitrate(aggregate.finalBitrate) : "—"}
          </footer>
        ) : null}
      </div>
    </main>
  )
}
