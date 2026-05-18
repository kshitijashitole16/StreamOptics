"use client"

import { RefObject, useEffect, useRef } from "react"
import {
  captureTtffOnce,
  markPlaybackIntent,
  resetTelemetrySession,
} from "@/src/lib/telemetry-session"
import { useMediaStore } from "@/src/store/useMediaStore"

export interface UseTelemetryOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  streamUrl: string
}

/**
 * Client-side QoS loop: TTFF, stall accounting, and playback sync via DOM listeners.
 * Uses store.getState() in handlers so the VideoPlayer shell never re-renders on metrics.
 */
export function useTelemetry({ videoRef, streamUrl }: UseTelemetryOptions) {
  const stallStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    resetTelemetrySession()
    const trimmed = streamUrl.trim()
    if (trimmed) {
      markPlaybackIntent()
    }
  }, [streamUrl])

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
