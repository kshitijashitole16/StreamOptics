"use client"

import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { markPlaybackIntent } from "@/src/hooks/useTelemetry"
import { useMediaStore } from "@/src/store/useMediaStore"

interface ControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>
}

function formatTimestamp(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = Math.floor(safeSeconds % 60)
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l10.99-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M7 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm10 0a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M14 5.12a1 1 0 0 1 1.71-.7A9.99 9.99 0 0 1 19 12a10 10 0 0 1-3.29 7.58 1 1 0 1 1-1.42-1.4A8 8 0 0 0 17 12a7.98 7.98 0 0 0-2.71-6.17A1 1 0 0 1 14 5.12ZM5.29 9.29A1 1 0 0 1 6 9h2.58l3.7-3.12A1 1 0 0 1 14 6.64v10.72a1 1 0 0 1-1.72.76L8.58 15H6a1 1 0 0 1-.71-.29l-2-2a1 1 0 0 1 0-1.42l2-2Z" />
    </svg>
  )
}

function MutedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M13.95 5.68a1 1 0 0 1 .05.31v10.72a1 1 0 0 1-1.72.76L8.58 15H6a1 1 0 0 1-.71-.29l-2-2a1 1 0 0 1 0-1.42l2-2A1 1 0 0 1 6 9h2.58l3.7-3.12a1 1 0 0 1 1.67-.2ZM20.71 7.29a1 1 0 0 1 0 1.42L17.41 12l3.3 3.29a1 1 0 0 1-1.42 1.42L16 13.41l-3.29 3.3a1 1 0 0 1-1.42-1.42l3.3-3.29-3.3-3.29a1 1 0 0 1 1.42-1.42L16 10.59l3.29-3.3a1 1 0 0 1 1.42 0Z" />
    </svg>
  )
}

function SettingsGearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5Zm7.43-2.53c.04-.32.07-.66.07-1s-.03-.68-.07-1l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.5 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.99s.03.68.07 1l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.31.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.5 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65Z" />
    </svg>
  )
}

export function Controls({ videoRef }: ControlsProps) {
  const menuId = useId()
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false)
  const qualityMenuRef = useRef<HTMLDivElement>(null)
  const qualityTriggerRef = useRef<HTMLButtonElement>(null)

  const isPlaying = useMediaStore((state) => state.isPlaying)
  const currentTime = useMediaStore((state) => state.currentTime)
  const duration = useMediaStore((state) => state.duration)
  const volume = useMediaStore((state) => state.volume)
  const isMuted = useMediaStore((state) => state.isMuted)
  const availableQualities = useMediaStore((state) => state.availableQualities)
  const currentQuality = useMediaStore((state) => state.currentQuality)
  const setCurrentTime = useMediaStore((state) => state.setCurrentTime)
  const setVolume = useMediaStore((state) => state.setVolume)
  const setIsMuted = useMediaStore((state) => state.setIsMuted)
  const setManualQuality = useMediaStore((state) => state.setManualQuality)
  const setAdaptiveBitrate = useMediaStore((state) => state.setAdaptiveBitrate)
  const showStatsPanel = useMediaStore((state) => state.showStatsPanel)
  const toggleShowStatsPanel = useMediaStore((state) => state.toggleShowStatsPanel)

  const progressPercentage = useMemo(() => {
    if (duration <= 0) return 0
    return (currentTime / duration) * 100
  }, [currentTime, duration])

  useEffect(() => {
    if (!isQualityMenuOpen) return undefined

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (qualityMenuRef.current?.contains(target)) return
      if (qualityTriggerRef.current?.contains(target)) return
      setIsQualityMenuOpen(false)
    }

    const handleKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return
      if (event.key === "Escape") setIsQualityMenuOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown, { passive: true })
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isQualityMenuOpen])

  const handlePlayPauseToggle = () => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) {
      markPlaybackIntent()
      void element.play().catch(() => {
        // AbortError: play() interrupted by engine teardown or stream switch.
      })
      return
    }
    element.pause()
  }

  const handleSeek = (nextValue: number) => {
    const element = videoRef.current
    if (!element || duration <= 0) return
    const nextTime = (nextValue / 100) * duration
    element.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const handleVolumeChange = (nextValue: number) => {
    const element = videoRef.current
    if (!element) return
    const normalizedVolume = Math.max(0, Math.min(1, nextValue))
    element.volume = normalizedVolume
    element.muted = normalizedVolume === 0
    setVolume(normalizedVolume)
    setIsMuted(normalizedVolume === 0)
  }

  const handleMuteToggle = () => {
    const element = videoRef.current
    if (!element) return
    const shouldMute = !element.muted
    element.muted = shouldMute
    setIsMuted(shouldMute)
  }

  const handleQualityMenuKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setIsQualityMenuOpen((open) => !open)
    }
  }

  return (
    <>
      <div
        ref={qualityMenuRef}
        className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-2 md:right-4 md:top-4"
      >
        <button
          type="button"
          aria-pressed={showStatsPanel}
          aria-label="Toggle Stats for Nerds"
          onClick={toggleShowStatsPanel}
          className="pointer-events-auto rounded-full border border-white/25 bg-black/45 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Stats for Nerds
        </button>

        <div className="pointer-events-auto relative">
          <button
            ref={qualityTriggerRef}
            type="button"
            id={`${menuId}-trigger`}
            aria-haspopup="true"
            aria-expanded={isQualityMenuOpen}
            aria-controls={`${menuId}-menu`}
            aria-label="Playback quality"
            tabIndex={0}
            onClick={() => setIsQualityMenuOpen((open) => !open)}
            onKeyDown={handleQualityMenuKeyDown}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <SettingsGearIcon />
          </button>

          {isQualityMenuOpen ? (
            <div
              id={`${menuId}-menu`}
              role="menu"
              aria-labelledby={`${menuId}-trigger`}
              className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/20 bg-black/70 py-2 text-left text-sm text-white shadow-xl backdrop-blur-md"
            >
              <p className="border-b border-white/10 px-3 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Quality
              </p>
              <div className="max-h-56 overflow-y-auto py-1">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentQuality === "auto"}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  onClick={() => {
                    setAdaptiveBitrate()
                    setIsQualityMenuOpen(false)
                  }}
                >
                  <span>Auto (ABR)</span>
                  {currentQuality === "auto" ? (
                    <span className="text-xs text-emerald-400">Active</span>
                  ) : null}
                </button>
                {availableQualities.map((quality) => {
                  const isActive = currentQuality === quality.id
                  return (
                    <button
                      key={quality.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                      onClick={() => {
                        setManualQuality(quality.id)
                        setIsQualityMenuOpen(false)
                      }}
                    >
                      <span className="font-medium">{quality.name}</span>
                      <span className="text-xs text-zinc-400">
                        {Math.round(quality.bitrate / 1000)} kbps
                      </span>
                    </button>
                  )
                })}
              </div>
              {availableQualities.length === 0 ? (
                <p className="px-3 py-2 text-xs text-zinc-500">No renditions reported yet.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-xl border border-white/20 bg-black/40 p-3 text-white backdrop-blur-md md:inset-x-4 md:bottom-4 md:p-4">
        <div className="pointer-events-auto flex flex-col gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercentage}
            aria-label="Seek timeline"
            onChange={(event) => handleSeek(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-white"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={isPlaying ? "Pause video" : "Play video"}
              onClick={handlePlayPauseToggle}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <p className="min-w-[105px] text-sm tabular-nums text-zinc-100">
              {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
            </p>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                onClick={handleMuteToggle}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {isMuted ? <MutedIcon /> : <VolumeIcon />}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                aria-label="Volume level"
                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-white/20 accent-white md:w-32"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
