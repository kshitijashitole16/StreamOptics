"use client"

import { RefObject, useEffect, useRef } from "react"
import {
  captureTtffOnce,
  markPlaybackIntent,
  resetTelemetrySession,
} from "@/src/lib/telemetry-session"
import { useMediaStore } from "@/src/store/useMediaStore"
import type {
  StreamingProtocol,
  TelemetryBatchMessage,
  TelemetryClientMessage,
  TelemetryInitAckMessage,
  TelemetryInitMessage,
  TelemetryLogEntry,
  TelemetryServerMessage,
} from "@/src/shared/telemetry"

export interface UseTelemetryOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  streamUrl: string
}

const TELEMETRY_WS_URL = process.env.NEXT_PUBLIC_TELEMETRY_WS_URL ?? "ws://localhost:4000"

function detectProtocol(streamUrl: string): StreamingProtocol {
  if (streamUrl.includes(".mpd")) return "DASH"
  return "HLS"
}

function getForwardBufferLength(video: HTMLVideoElement): number {
  const { buffered, currentTime } = video
  for (let index = 0; index < buffered.length; index += 1) {
    const start = buffered.start(index)
    const end = buffered.end(index)
    if (currentTime >= start && currentTime <= end) return Math.max(0, end - currentTime)
  }
  return 0
}

function isInitAckMessage(message: TelemetryServerMessage): message is TelemetryInitAckMessage {
  return message.type === "init_ack"
}

/**
 * Client-side QoS loop: TTFF, stall accounting, and playback sync via DOM listeners.
 * Uses store.getState() in handlers so the VideoPlayer shell never re-renders on metrics.
 */
export function useTelemetry({ videoRef, streamUrl }: UseTelemetryOptions) {
  const stallStartedAtRef = useRef<number | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const batchQueueRef = useRef<TelemetryLogEntry[]>([])

  const flushQueue = () => {
    const socket = socketRef.current
    const sessionId = sessionIdRef.current
    if (!socket || !sessionId) return
    if (socket.readyState !== WebSocket.OPEN) return
    if (batchQueueRef.current.length === 0) return

    const payload: TelemetryBatchMessage = {
      type: "telemetry_batch",
      sessionId,
      logs: [...batchQueueRef.current],
    }
    socket.send(JSON.stringify(payload satisfies TelemetryClientMessage))
    batchQueueRef.current = []
  }

  useEffect(() => {
    resetTelemetrySession()
    sessionIdRef.current = null
    batchQueueRef.current = []

    const trimmed = streamUrl.trim()
    if (trimmed) {
      markPlaybackIntent()
    }
  }, [streamUrl])

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const trimmed = streamUrl.trim()
    if (!trimmed) return undefined

    const protocol = detectProtocol(trimmed)
    const socket = new WebSocket(TELEMETRY_WS_URL)
    socketRef.current = socket

    const handleOpen = () => {
      const initPayload: TelemetryInitMessage = {
        type: "init",
        streamUrl: trimmed,
        protocol,
      }
      socket.send(JSON.stringify(initPayload))
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string) as TelemetryServerMessage
        if (isInitAckMessage(payload)) {
          sessionIdRef.current = payload.sessionId
        }
      } catch {
        // Ignore non-JSON payloads from the backend.
      }
    }

    const handleError = () => {
      // Keep playback thread quiet; telemetry failures should not block UX.
    }

    socket.addEventListener("open", handleOpen)
    socket.addEventListener("message", handleMessage)
    socket.addEventListener("error", handleError)

    return () => {
      flushQueue()
      socket.removeEventListener("open", handleOpen)
      socket.removeEventListener("message", handleMessage)
      socket.removeEventListener("error", handleError)
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Player lifecycle cleanup")
      }
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      sessionIdRef.current = null
      batchQueueRef.current = []
    }
  }, [streamUrl])

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const video = videoRef.current
    const trimmed = streamUrl.trim()
    if (!video || !trimmed) return undefined

    const tick = () => {
      const snapshot = useMediaStore.getState()
      const entry: TelemetryLogEntry = {
        timestamp: new Date().toISOString(),
        currentBitrate: snapshot.currentBitrate,
        forwardBufferLength: getForwardBufferLength(video),
        totalBufferDuration: snapshot.totalBufferDuration,
        ttff: snapshot.ttff,
        bufferCount: snapshot.bufferCount,
      }
      batchQueueRef.current.push(entry)
      flushQueue()
    }

    const intervalId = window.setInterval(tick, 3000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [streamUrl, videoRef])

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const video = videoRef.current
    if (!video) return undefined

    const resolveStall = () => {
      if (stallStartedAtRef.current === null) return
      const stallDurationMs = performance.now() - stallStartedAtRef.current
      stallStartedAtRef.current = null
      useMediaStore.getState().endBufferStall(stallDurationMs)
    }

    const handleWaiting = () => {
      if (stallStartedAtRef.current !== null) return
      stallStartedAtRef.current = performance.now()
      useMediaStore.getState().beginBufferStall()
    }

    const handlePlaying = () => {
      const ttffMs = captureTtffOnce()
      if (ttffMs !== null) {
        useMediaStore.getState().setTtff(ttffMs)
      }
      resolveStall()
      useMediaStore.getState().setIsPlaying(true)
    }

    const handleCanPlay = () => {
      resolveStall()
    }

    const handlePause = () => {
      useMediaStore.getState().setIsPlaying(false)
    }

    const handleTimeUpdate = () => {
      useMediaStore.getState().setCurrentTime(video.currentTime)
    }

    const handleLoadedMetadata = () => {
      useMediaStore.getState().setDuration(
        Number.isFinite(video.duration) ? video.duration : 0,
      )
      useMediaStore.getState().setVolume(video.volume)
      useMediaStore.getState().setIsMuted(video.muted)
    }

    const handleVolumeChange = () => {
      useMediaStore.getState().setVolume(video.volume)
      useMediaStore.getState().setIsMuted(video.muted)
    }

    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("playing", handlePlaying)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("volumechange", handleVolumeChange)

    return () => {
      if (stallStartedAtRef.current !== null) {
        resolveStall()
      }
      video.removeEventListener("waiting", handleWaiting)
      video.removeEventListener("playing", handlePlaying)
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("volumechange", handleVolumeChange)
    }
  }, [streamUrl, videoRef])
}

export { markPlaybackIntent }
