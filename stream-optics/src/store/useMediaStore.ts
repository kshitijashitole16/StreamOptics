"use client"

import { create } from "zustand"

export interface StreamQuality {
  id: string
  name: string
  bitrate: number
}

export type ActiveProtocolLabel = "HLS" | "DASH" | "—"

export interface MediaState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  availableQualities: StreamQuality[]
  currentQuality: string
  isBuffering: boolean
  ttff: number
  bufferCount: number
  totalBufferDuration: number
  currentBitrate: number
  showStatsPanel: boolean
  activeProtocol: ActiveProtocolLabel
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentTime: (currentTime: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setIsMuted: (isMuted: boolean) => void
  setAvailableQualities: (qualities: StreamQuality[]) => void
  setManualQuality: (qualityId: string | number) => void
  setAdaptiveBitrate: () => void
  setIsBuffering: (isBuffering: boolean) => void
  setTtff: (ttff: number) => void
  setBufferCount: (bufferCount: number) => void
  setTotalBufferDuration: (totalBufferDuration: number) => void
  setCurrentBitrate: (currentBitrate: number) => void
  setShowStatsPanel: (showStatsPanel: boolean) => void
  toggleShowStatsPanel: () => void
  setActiveProtocol: (activeProtocol: ActiveProtocolLabel) => void
  /** `waiting` fired: mark stall active and increment stall counter. */
  beginBufferStall: () => void
  /** Stall ended: accumulate seconds (ms → s) and clear buffering flag. */
  endBufferStall: (stallDurationMs: number) => void
  resetStreamMediaState: () => void
  resetTelemetryMetrics: () => void
}

export const useMediaStore = create<MediaState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  availableQualities: [],
  currentQuality: "auto",
  isBuffering: false,
  ttff: 0,
  bufferCount: 0,
  totalBufferDuration: 0,
  currentBitrate: 0,
  showStatsPanel: false,
  activeProtocol: "—",
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setAvailableQualities: (availableQualities) => set({ availableQualities }),
  setManualQuality: (qualityId) =>
    set((state) => {
      const match = state.availableQualities.find((q) => q.id === String(qualityId))
      return {
        currentQuality: String(qualityId),
        currentBitrate: match?.bitrate ?? state.currentBitrate,
      }
    }),
  setAdaptiveBitrate: () => set({ currentQuality: "auto" }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setTtff: (ttff) => set({ ttff }),
  setBufferCount: (bufferCount) => set({ bufferCount }),
  setTotalBufferDuration: (totalBufferDuration) => set({ totalBufferDuration }),
  setCurrentBitrate: (currentBitrate) => set({ currentBitrate }),
  setShowStatsPanel: (showStatsPanel) => set({ showStatsPanel }),
  toggleShowStatsPanel: () => set((state) => ({ showStatsPanel: !state.showStatsPanel })),
  setActiveProtocol: (activeProtocol) => set({ activeProtocol }),
  beginBufferStall: () =>
    set((state) => ({
      isBuffering: true,
      bufferCount: state.bufferCount + 1,
    })),
  endBufferStall: (stallDurationMs) =>
    set((state) => ({
      isBuffering: false,
      totalBufferDuration:
        state.totalBufferDuration + Math.max(0, stallDurationMs) / 1000,
    })),
  resetTelemetryMetrics: () =>
    set({
      isBuffering: false,
      ttff: 0,
      bufferCount: 0,
      totalBufferDuration: 0,
      currentBitrate: 0,
    }),
  resetStreamMediaState: () =>
    set({
      availableQualities: [],
      currentQuality: "auto",
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isBuffering: false,
      ttff: 0,
      bufferCount: 0,
      totalBufferDuration: 0,
      currentBitrate: 0,
      activeProtocol: "—",
    }),
}))
