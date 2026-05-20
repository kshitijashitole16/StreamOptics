"use client"

import type Hls from "hls.js"
import { RefObject, useEffect, useRef } from "react"
import { useMediaStore, type StreamQuality } from "@/src/store/useMediaStore"

export type StreamProtocol = "hls" | "dash" | "unknown"

export interface UseMediaEngineOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  streamUrl: string
}

function detectProtocol(url: string): StreamProtocol {
  if (url.includes(".m3u8")) return "hls"
  if (url.includes(".mpd")) return "dash"
  return "unknown"
}

function buildHlsLevelName(level: { height?: number; name?: string }, index: number): string {
  if (level.name) return level.name
  if (level.height) return `${level.height}p`
  return `Level ${index + 1}`
}

function formatEngineError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "object" && error !== null) {
    const shakaError = error as {
      message?: string
      code?: number
      category?: string
      severity?: number
    }
    const parts = [
      shakaError.message,
      shakaError.code !== undefined ? `code=${shakaError.code}` : null,
      shakaError.category ? `category=${shakaError.category}` : null,
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(" · ")
    try {
      return JSON.stringify(error)
    } catch {
      return "Unknown playback engine error"
    }
  }
  return String(error)
}

function buildShakaVariantName(track: {
  height?: number | null
  width?: number | null
  bandwidth: number
}): string {
  const kbps = Math.round(track.bandwidth / 1000)
  if (track.height) return `${track.height}p · ${kbps} kbps`
  if (track.width) return `${track.width}w · ${kbps} kbps`
  return `${kbps} kbps`
}

let shakaNamespacePromise: Promise<ShakaNamespace> | null = null

function resolveShakaNamespace(moduleValue: unknown): ShakaNamespace {
  const moduleRecord = moduleValue as Record<string, unknown> & ShakaNamespace
  const defaultExport = moduleRecord.default as ShakaNamespace | undefined

  if (defaultExport?.Player) return defaultExport
  if (typeof moduleRecord.Player === "function") return moduleRecord

  if (typeof window !== "undefined") {
    const globalShaka = (window as unknown as { shaka?: ShakaNamespace }).shaka
    if (globalShaka?.Player) return globalShaka
  }

  throw new Error("Shaka namespace missing after dynamic import")
}

async function loadShakaNamespace(): Promise<ShakaNamespace> {
  if (typeof window === "undefined") {
    throw new Error("Shaka Player must load in the browser")
  }

  if (!shakaNamespacePromise) {
    shakaNamespacePromise = (async () => {
      const shakaModule = await import("shaka-player/dist/shaka-player.compiled.js")
      const shaka = resolveShakaNamespace(shakaModule)
      shaka.polyfill.installAll()
      if (typeof window !== "undefined") {
        ;(window as unknown as { shaka: ShakaNamespace }).shaka = shaka
      }
      return shaka
    })()
  }

  return shakaNamespacePromise
}

interface ShakaNamespace {
  polyfill: { installAll: () => void }
  Player: new (mediaElement?: HTMLMediaElement | null) => ShakaPlayerLike
}

interface ShakaPlayerLike {
  load: (uri: string, startTime?: number | null) => Promise<unknown>
  destroy: () => Promise<unknown>
  configure: (config: object) => boolean
  getVariantTracks: () => ShakaVariantTrack[]
  selectVariantTrack: (track: ShakaVariantTrack, clearBuffer?: boolean, safeMargin?: number) => void
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

interface ShakaVariantTrack {
  id?: number
  type?: string
  bandwidth: number
  height?: number | null
  width?: number | null
  active?: boolean
}

function applyHlsQuality(hls: Hls, selection: string) {
  if (selection === "auto") {
    hls.currentLevel = -1
    return
  }
  const index = Number.parseInt(selection, 10)
  if (!Number.isFinite(index) || index < 0 || index >= hls.levels.length) return
  hls.currentLevel = index
}

function applyShakaQuality(
  player: ShakaPlayerLike,
  variants: ShakaVariantTrack[],
  selection: string,
) {
  if (selection === "auto") {
    player.configure({ abr: { enabled: true } })
    return
  }
  const index = Number.parseInt(selection, 10)
  if (!Number.isFinite(index) || index < 0 || index >= variants.length) return
  const track = variants[index]
  if (!track) return
  player.configure({ abr: { enabled: false } })
  player.selectVariantTrack(track, true)
}

function syncHlsBitrate(hls: Hls) {
  const levelIndex = hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel
  const level = hls.levels[levelIndex]
  if (level?.bitrate) {
    useMediaStore.getState().setCurrentBitrate(level.bitrate)
  }
}

function syncShakaBitrate(player: ShakaPlayerLike) {
  const active = player.getVariantTracks().find((track) => track.active)
  if (active?.bandwidth) {
    useMediaStore.getState().setCurrentBitrate(active.bandwidth)
  }
}

/**
 * Binds HLS.js or Shaka Player to `videoRef` from `streamUrl` (`.m3u8` / `.mpd`).
 * Engines load only inside async client effects; teardown matches architecture (destroy on URL change / unmount).
 */
export function useMediaEngine({ videoRef, streamUrl }: UseMediaEngineOptions) {
  const hlsRef = useRef<Hls | null>(null)
  const shakaPlayerRef = useRef<ShakaPlayerLike | null>(null)
  const shakaVariantsRef = useRef<ShakaVariantTrack[]>([])

  const applySelectionToActiveEngine = () => {
    if (typeof window === "undefined") return
    const selection = useMediaStore.getState().currentQuality
    const hls = hlsRef.current
    if (hls) {
      applyHlsQuality(hls, selection)
      syncHlsBitrate(hls)
      return
    }
    const player = shakaPlayerRef.current
    if (player) {
      applyShakaQuality(player, shakaVariantsRef.current, selection)
      syncShakaBitrate(player)
    }
  }

  useEffect(() => {
    const unsubscribe = useMediaStore.subscribe((state, previousState) => {
      if (state.currentQuality === previousState.currentQuality) return
      applySelectionToActiveEngine()
    })
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    let disposed = false
    let shakaAdaptationHandler: (() => void) | null = null
    const video = videoRef.current
    const trimmedUrl = streamUrl.trim()

    const resetStreamState = () => {
      useMediaStore.getState().resetStreamMediaState()
    }

    if (!video || !trimmedUrl) {
      resetStreamState()
      return undefined
    }

    const protocol = detectProtocol(trimmedUrl)
    if (protocol === "unknown") {
      resetStreamState()
      return undefined
    }

    useMediaStore.getState().resetStreamMediaState()
    useMediaStore.getState().setActiveProtocol(protocol === "hls" ? "HLS" : "DASH")

    /** Reset native element without pause() to avoid interrupting in-flight play() promises. */
    const resetVideoElement = () => {
      video.removeAttribute("src")
      try {
        video.load()
      } catch {
        // Ignore reset errors during rapid stream switches.
      }
    }

    const destroyHls = () => {
      const instance = hlsRef.current
      hlsRef.current = null
      if (!instance) return
      instance.destroy()
    }

    const destroyShaka = async () => {
      const player = shakaPlayerRef.current
      shakaPlayerRef.current = null
      shakaVariantsRef.current = []
      if (!player) return
      await player.destroy()
    }

    void (async () => {
      if (protocol === "hls") {
        const { default: HlsCtor } = await import("hls.js")
        if (disposed || videoRef.current !== video) return

        destroyHls()
        await destroyShaka()
        resetVideoElement()

        const canPlayNativeHls =
          video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
          video.canPlayType("application/x-mpegURL") !== ""

        if (HlsCtor.isSupported()) {
          const hls = new HlsCtor({
            enableWorker: true,
            lowLatencyMode: false,
          })

          if (disposed || videoRef.current !== video) {
            hls.destroy()
            return
          }

          hlsRef.current = hls
          hls.attachMedia(video)
          hls.loadSource(trimmedUrl)

          const onManifestParsed = () => {
            if (disposed) return
            const levels = hls.levels
            const qualities: StreamQuality[] = levels.map((level, index) => ({
              id: String(index),
              name: buildHlsLevelName(level, index),
              bitrate: level.bitrate ?? 0,
            }))
            useMediaStore.getState().setAvailableQualities(qualities)
            applySelectionToActiveEngine()
            syncHlsBitrate(hls)
          }

          const onLevelSwitched = () => {
            if (disposed) return
            syncHlsBitrate(hls)
          }

          hls.on(HlsCtor.Events.MANIFEST_PARSED, onManifestParsed)
          hls.on(HlsCtor.Events.LEVEL_SWITCHED, onLevelSwitched)

          hls.on(HlsCtor.Events.ERROR, (_event, data) => {
            if (!data.fatal) return
            if (disposed) return
            switch (data.type) {
              case HlsCtor.ErrorTypes.NETWORK_ERROR:
                hls.startLoad()
                break
              case HlsCtor.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError()
                break
              default:
                destroyHls()
                resetVideoElement()
                break
            }
          })
        } else if (canPlayNativeHls) {
          video.src = trimmedUrl
          useMediaStore.getState().setAvailableQualities([])
        } else {
          useMediaStore.getState().setAvailableQualities([])
        }
        return
      }

      if (protocol === "dash") {
        try {
          const shaka = await loadShakaNamespace()
          if (disposed || videoRef.current !== video) return

          destroyHls()
          await destroyShaka()
          resetVideoElement()

          const player = new shaka.Player(video)

          if (disposed || videoRef.current !== video) {
            await player.destroy()
            return
          }

          shakaAdaptationHandler = () => {
            if (disposed) return
            syncShakaBitrate(player)
          }

          player.addEventListener("adaptation", shakaAdaptationHandler)

          shakaPlayerRef.current = player
          await player.load(trimmedUrl)
          if (disposed) return

          const tracks = player.getVariantTracks()
          const variantTracks = tracks.filter((t) => !t.type || t.type === "variant")

          const uniqueVariants: ShakaVariantTrack[] = []
          const seen = new Set<string>()
          for (const track of variantTracks) {
            const key = `${track.bandwidth}-${track.height ?? 0}-${track.width ?? 0}`
            if (seen.has(key)) continue
            seen.add(key)
            uniqueVariants.push(track)
          }

          uniqueVariants.sort((a, b) => (a.bandwidth ?? 0) - (b.bandwidth ?? 0))
          shakaVariantsRef.current = uniqueVariants

          const qualities: StreamQuality[] = uniqueVariants.map((track, index) => ({
            id: String(index),
            name: buildShakaVariantName(track),
            bitrate: track.bandwidth ?? 0,
          }))
          useMediaStore.getState().setAvailableQualities(qualities)
          applySelectionToActiveEngine()
          syncShakaBitrate(player)
        } catch (error) {
          console.error(
            "[StreamOptics] Failed to initialize DASH engine:",
            formatEngineError(error),
            error,
          )
          useMediaStore.getState().setAvailableQualities([])
        }
      }
    })()

    return () => {
      disposed = true
      const shakaPlayer = shakaPlayerRef.current
      if (shakaPlayer && shakaAdaptationHandler) {
        shakaPlayer.removeEventListener("adaptation", shakaAdaptationHandler)
      }
      destroyHls()
      void (async () => {
        await destroyShaka()
        if (videoRef.current === video) {
          resetVideoElement()
        }
      })()
    }
  }, [streamUrl, videoRef])
}
