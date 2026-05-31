# StreamOptics

StreamOptics is a video playback observability platform that combines a custom adaptive-streaming player with real-time QoS telemetry and session analytics.

The frontend plays external HLS/DASH streams, collects playback quality metrics (TTFF, stalls, bitrate, buffer depth), and pushes telemetry to the backend. The backend ingests, stores, and aggregates these metrics for dashboard analysis.

## Purpose of this application

- Provide a unified player for HLS and DASH streams
- Measure playback quality in near real time
- Persist session telemetry for post-playback analysis
- Visualize playback health trends in a dashboard
- Offer an architecture baseline for media telemetry systems

## Tech stack

### Frontend (`stream-optics/`)

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Zustand for high-frequency media state
- HLS.js for HLS playback engine
- Shaka Player for DASH playback engine
- Recharts for dashboard visualizations
- Browser WebSocket client for telemetry streaming

### Backend (`backend/`)

- Node.js + TypeScript
- Express 5 for REST APIs
- `ws` for WebSocket telemetry ingestion
- Prisma 7 + `@prisma/adapter-pg`
- PostgreSQL via `pg`
- CORS + dotenv

### Infrastructure

- Docker Compose for local PostgreSQL
- Prisma schema + migrations/push workflow for DB shape

## System architecture

```mermaid
flowchart LR
  A[Player UI<br/>Next.js + React] --> B[Media Engine Hook<br/>HLS.js or Shaka]
  B --> C[HTMLVideoElement]
  C --> D[Telemetry Hook<br/>event listeners + 3s batching]
  D --> E[WebSocket Ingestion<br/>Node ws]
  E --> F[(PostgreSQL<br/>PlaybackSession + TelemetryLog)]
  F --> G[REST Aggregation APIs]
  G --> H[Dashboard UI<br/>metrics + charts]
```

## Frontend architecture (in depth)

### 1) Route and UI composition

- `src/app/player/page.tsx` hosts playback entry and stream switching
- `src/components/player/VideoPlayer.tsx` binds video element, controls, and telemetry hooks
- `src/app/dashboard/page.tsx` queries aggregate/timeline APIs and renders charts/cards

### 2) Media engine lifecycle (`useMediaEngine`)

- Detect protocol from URL extension (`.m3u8` vs `.mpd`)
- For HLS:
  - Load HLS.js dynamically
  - Attach engine to `<video>`
  - Read available levels and expose quality options
  - Recover from network/media errors when possible
- For DASH:
  - Load Shaka dynamically and install polyfills
  - Attach `shaka.Player` to `<video>`
  - Extract and deduplicate variant tracks
  - Support manual/auto quality switching
- On stream change/unmount:
  - Destroy active engine
  - Reset video source
  - Clear quality and protocol state safely

### 3) State strategy (`useMediaStore`)

- Uses Zustand to isolate volatile playback state from UI shell rerenders
- Tracks:
  - playback status (`isPlaying`, `isBuffering`)
  - timeline (`currentTime`, `duration`)
  - quality and bitrate
  - telemetry counters (`ttff`, `bufferCount`, `totalBufferDuration`)
- Hooks use `store.getState()` inside listeners to avoid unnecessary component rerenders

### 4) Telemetry client pipeline (`useTelemetry`)

- On stream start:
  - open WebSocket
  - send `init` payload `{ streamUrl, protocol }`
  - receive `init_ack` with `sessionId`
- During playback:
  - listen to media events (`waiting`, `playing`, `canplay`, `timeupdate`)
  - compute TTFF and stall durations
  - snapshot bitrate/buffer metrics every 3 seconds
  - queue and flush batched logs as `telemetry_batch`
- On cleanup:
  - flush pending queue
  - close socket gracefully
  - clear local telemetry refs

## Backend architecture (in depth)

### 1) Ingestion server

- Single HTTP server hosts both REST (Express) and WebSocket (`ws`) endpoints
- WebSocket message contract:
  - `init` creates `PlaybackSession`
  - `telemetry_batch` appends many `TelemetryLog` rows
- Each socket keeps lightweight in-memory state (`sessionId`) for message continuity

### 2) Data persistence and normalization

- Prisma client uses Postgres adapter with `DATABASE_URL`
- Incoming telemetry is normalized before writes:
  - timestamp parsing fallback
  - non-negative numeric guards
  - integer rounding where required
- Batched inserts use `createMany` for ingestion efficiency

### 3) Query and analytics APIs

- `GET /api/health` liveness probe
- `GET /api/sessions` recent session index
- `GET /api/sessions/:id/aggregate` computes:
  - buffering ratio
  - total stall count
  - final bitrate
  - first non-zero TTFF
- `GET /api/sessions/:id/timeline` returns ordered bitrate/buffer series for charts

## End-to-end workflow

1. User opens `/player` and chooses HLS or DASH stream URL
2. Frontend engine hook attaches correct playback engine to the video element
3. Telemetry hook opens WebSocket and initializes a backend playback session
4. Playback events are captured and converted into periodic telemetry snapshots
5. Client sends batched snapshots every 3 seconds over WebSocket
6. Backend validates and stores logs in PostgreSQL linked to the session
7. User opens `/dashboard`
8. Dashboard fetches session list, aggregate KPIs, and timeline points over REST
9. Charts and metric cards render historical playback quality for selected sessions

## Data model overview

### `PlaybackSession`

- `id` (UUID, primary key)
- `streamUrl` (source URL played in session)
- `protocol` (`HLS` or `DASH`)
- `createdAt` (session start time)

### `TelemetryLog`

- `id` (UUID, primary key)
- `sessionId` (foreign key to `PlaybackSession`)
- `timestamp` (event/sample time)
- `bitrate` (bps)
- `bufferLength` (seconds of forward buffer)
- `totalBufferTime` (cumulative seconds stalled)
- `ttff` (milliseconds)
- `bufferCount` (stall counter)

## Application startup (local development)

This project uses Docker Compose for a local PostgreSQL database that matches the backend Prisma connection string:

`postgresql://postgres:postgres@localhost:5432/streamoptics?schema=public`

### 1) Start PostgreSQL (detached)

From repo root:

```bash
docker compose up -d
```

### 2) Verify container startup logs

```bash
docker compose logs -f postgres
```

Look for: `database system is ready to accept connections`.

### 3) Stop services when done

```bash
docker compose down
```

The `postgres_data` named volume keeps your data between restarts.

### 4) Backend environment

Create or verify `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/streamoptics?schema=public"
```

### 5) Push Prisma schema

```bash
npm --prefix backend exec -- prisma db push \
  --config "/Users/vikasbairwa/Documents/StreamOptics/backend/prisma.config.ts" \
  --schema "/Users/vikasbairwa/Documents/StreamOptics/backend/prisma/schema.prisma" \
  --url "postgresql://postgres:postgres@localhost:5432/streamoptics?schema=public"
```

### 6) Start backend

```bash
npm --prefix backend run dev
```

Backend runs on `http://localhost:4000`.

### 7) Start frontend

```bash
cd stream-optics
npm run dev
```

Frontend runs on `http://localhost:3000`.

### 8) Optional frontend env overrides

If you are not using defaults, set:

- `NEXT_PUBLIC_TELEMETRY_WS_URL` (default `ws://localhost:4000`)
- `NEXT_PUBLIC_BACKEND_HTTP_URL` (default `http://localhost:4000`)

## Notes

- Video files are not stored in this repository; streams are remote URLs
- If you use `npm run start` in `backend/`, build first with `npm run build`
