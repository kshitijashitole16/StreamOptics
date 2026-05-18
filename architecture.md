Architecture Documentation: StreamOptics

This document details the architectural design, directory structure, data flow, and state management strategy for StreamOptics—a high-performance media playback and real-time Quality of Service (QoS) telemetry platform.

1. System Architecture Overview

StreamOptics is designed as a frontend-heavy application optimized for low-latency media telemetry and efficient state encapsulation. The architecture cleanly separates the unstable, high-frequency event cycles of video playback from the rest of the application using atomic state distribution.

+------------------------------------------------------------------------+
|                           CLIENT (Next.js)                             |
|                                                                        |
|  +--------------------+    Atomic State    +------------------------+  |
|  | Custom Video UI    | <----------------> | Zustand Media Store    |  |
|  +--------------------+                    +------------------------+  |
|            |                                           ^               |
|     User Actions & Refs                                | Metrics       |
|            v                                           v               |
|  +------------------------------------------------------------------+  |
|  |                      HTML5 Media Element                         |  |
|  |           (Attached to HLS.js / Shaka Player Engines)            |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
|                                   |  Throttled JSON Payloads           |
|                                   |  (Every 3-5 seconds via WebSockets)|
+-----------------------------------|------------------------------------+
                                    v
+------------------------------------------------------------------------+
|                          BACKEND (Node.js)                             |
|                                                                        |
|               +--------------------------------------+                 |
|               |       Express + WebSocket Server     |                 |
|               +--------------------------------------+                 |
|                                   |                                    |
|                                   |  Prisma Client                     |
|                                   v                                    |
|               +--------------------------------------+                 |
|               |         PostgreSQL Database          |                 |
|               +--------------------------------------+                 |
+------------------------------------------------------------------------+


2. Target Directory Structure

To support this architectural blueprint, your root project directory (STREAMOPTICS/) will expand to separate the Next.js frontend application from the lightweight telemetry backend ecosystem:

STREAMOPTICS/
├── .cursor/
│   ├── rules/
│   └── skills/
├── backend/                       # Lightweight Ingestion Pipeline (Day 4)
│   ├── prisma/
│   │   └── schema.prisma          # Database Schema Mapping
│   ├── src/
│   │   ├── server.ts              # Express & WebSocket Initialization
│   │   └── routes.ts              # Minimal Aggregation Endpoints
│   ├── package.json
│   └── tsconfig.json
└── stream-optics/                 # Next.js Frontend Core Workspace
    ├── public/                    # Static Assets & Test Streams Reference
    ├── src/
    │   ├── app/                   # File-Based Routing Layer
    │   │   ├── page.tsx           # Landing Page
    │   │   ├── player/
    │   │   │   └── page.tsx       # Unified Video Player View
    │   │   └── dashboard/
    │   │       └── page.tsx       # Admin QoS Metrics Center
    │   ├── components/            # Modular Frontend Component Tree
    │   │   ├── ui/                # Shared Design Elements (Buttons, Sliders)
    │   │   ├── player/
    │   │   │   ├── VideoPlayer.tsx# Core Media Lifecycle Shell
    │   │   │   ├── Controls.tsx   # Custom Playback Overlay Controls
    │   │   │   └── StatsPanel.tsx # "Stats for Nerds" Floating Overlay
    │   │   └── dashboard/
    │   │       ├── AnalyticsChart.tsx # Recharts Implementation
    │   │       └── MetricsCard.tsx# QoS Performance Scorecards
    │   ├── hooks/
    │   │   ├── useMediaEngine.ts  # Custom Hook for Shaka/HLS.js Lifecycle
    │   │   └── useTelemetry.ts    # WebSockets Streaming & Batching Hook
    │   └── store/
    │       └── useMediaStore.ts   # Zustand Atomic State Slice
    ├── package.json
    └── tailwind.config.ts


3. Core Component & State Management Strategy

The Playback Re-render Problem

Video elements emit updates (e.g., timeupdate) up to 4 times per second. Binding these updates to local component state in a traditional React setup causes massive, cascading re-renders across the layout, hurting overall player thread performance.

The Solution: Zustand Atomic Slices

We isolate highly volatile parameters inside a specialized Zustand store (useMediaStore.ts). Component parts like the progress bar slider or the "Stats for Nerds" overlay read exclusively from atomic slices of this store, protecting the main wrapper component layout from redundant updates.

// Architectural Blueprint for useMediaStore.ts
interface MediaState {
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  currentBitrate: number;
  ttff: number; // Time-to-First-Frame
  bufferDuration: number;
  setPlaying: (playing: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  updatePlaybackProgress: (time: number, duration: number) => void;
  logTelemetryEvent: (metrics: Partial<MediaState>) => void;
}


4. Key Data Flows

A. Media Engine Lifecycle & Initialization Flow

Mount: The /player route mounts the VideoPlayer.tsx core layout wrapper.

Detection: The useMediaEngine hook reads the stream URL format (.m3u8 vs .mpd).

Instantiation: * If .m3u8, an Hls engine instance binds to the HTML5 video element ref.

If .mpd, a shaka.Player engine instance instantiates and attaches to the target element ref.

Teardown: When the path updates or changes streams, the hook invokes .destroy() or .detach(), clears native DOM event listeners, and completely clears memory loops.

B. Client Telemetry Batching & Ingestion Flow

Intercept: The player triggers native video element markers (waiting, playing, ratechange).

Calculate: The telemetry logic updates QoS tracking benchmarks (calculating delta offsets for TTFF and gathering buffering durations).

Batch: Instead of overloading the server with constant network requests, the client pushes logs into an internal data queue.

Flush: Every 3 seconds, a timer flushes the data queue, streaming the accumulated JSON batch down the active WebSocket connection to the backend.

5. Lightweight Telemetry Database Schema

The database relies on a highly sequential, append-only structure optimized to handle time-series logs generated by the WebSocket pipeline.

// backend/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model PlaybackSession {
  id          String         @id @default(uuid())
  streamUrl   String
  protocol    String         // "HLS" or "DASH"
  createdAt   DateTime       @default(now())
  telemetry   TelemetryLog[]
}

model TelemetryLog {
  id              String          @id @default(uuid())
  sessionId       String
  session         PlaybackSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  timestamp       DateTime        @default(now())
  bitrate         Int             // Current resolution bitrate in bps
  bufferLength    Float           // Browser forward buffer ahead depth (seconds)
  totalBufferTime Float           // Cumulative time spent stalling (seconds)
  ttff            Int             // Time-To-First-Frame metric (ms)
}


6. SDE-2 Best Practices & Optimization Checklists

Performance & Memory Lifecycle

Explicit Destruction: Always invoke engine teardown processes (hls.destroy() or shakaPlayer.destroy()) inside React's useEffect cleanups. Failing to do so leaks massive memory on single-page-app (SPA) routes.

Avoid Layout Shifts: Reserve a fixed aspect-ratio container (e.g., aspect-video) for your player block before instantiation. This ensures a zero layout shift rating for Core Web Vitals.

Passive Listener Support: When attaching direct DOM event listeners (like touchstart or scroll) during mobile TV optimizations, mark them as passive: true to optimize main-thread scrolling performance.