import "dotenv/config"
import cors from "cors"
import express from "express"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { createServer } from "node:http"
import { WebSocketServer, type WebSocket } from "ws"
import type {
  SessionSummary,
  TelemetryAggregateResponse,
  TelemetryBatchMessage,
  TelemetryClientMessage,
  TelemetryInitMessage,
  TelemetryInitAckMessage,
  TelemetryLogEntry,
  TelemetryTimelineResponse,
} from "../../stream-optics/src/shared/telemetry"

const PORT = Number(process.env.PORT ?? 4000)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the backend service")
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

const app = express()
app.use(cors())
app.use(express.json())

interface SocketState {
  sessionId: string | null
}

function isInitMessage(message: TelemetryClientMessage): message is TelemetryInitMessage {
  return message.type === "init"
}

function isBatchMessage(message: TelemetryClientMessage): message is TelemetryBatchMessage {
  return message.type === "telemetry_batch"
}

function parseMessage(rawData: unknown): TelemetryClientMessage | null {
  if (typeof rawData !== "string") return null
  try {
    const parsed = JSON.parse(rawData) as TelemetryClientMessage
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") return null
    return parsed
  } catch {
    return null
  }
}

function normalizeLogEntry(entry: TelemetryLogEntry) {
  const parsedTimestamp = new Date(entry.timestamp)
  return {
    timestamp: Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp,
    bitrate: Math.max(0, Math.round(entry.currentBitrate)),
    bufferLength: Math.max(0, entry.forwardBufferLength),
    totalBufferTime: Math.max(0, entry.totalBufferDuration),
    ttff: Math.max(0, Math.round(entry.ttff)),
    bufferCount: Math.max(0, Math.round(entry.bufferCount)),
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.get("/api/sessions", async (_req, res) => {
  try {
    const sessions = await prisma.playbackSession.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        streamUrl: true,
        protocol: true,
        createdAt: true,
      },
      take: 100,
    })

    const payload: SessionSummary[] = sessions.map((session) => ({
      sessionId: session.id,
      streamUrl: session.streamUrl,
      protocol: session.protocol === "DASH" ? "DASH" : "HLS",
      createdAt: session.createdAt.toISOString(),
    }))

    return res.json(payload)
  } catch (error) {
    console.error("Failed to load sessions list", error)
    return res.status(500).json({ error: "Failed to load sessions list" })
  }
})

app.get("/api/sessions/:id/aggregate", async (req, res) => {
  try {
    const { id } = req.params
    const session = await prisma.playbackSession.findUnique({
      where: { id },
      include: {
        telemetry: {
          orderBy: { timestamp: "asc" },
        },
      },
    })

    if (!session) {
      return res.status(404).json({ error: "Session not found" })
    }

    const logs = session.telemetry
    const first = logs[0]
    const last = logs[logs.length - 1]
    const totalDurationSeconds =
      first && last ? Math.max(1, (last.timestamp.getTime() - first.timestamp.getTime()) / 1000) : 1

    const finalBitrate = last?.bitrate ?? 0
    const totalBufferTime = last?.totalBufferTime ?? 0
    const totalStallCount = last?.bufferCount ?? 0
    const ttff = logs.find((log) => log.ttff > 0)?.ttff ?? 0

    const payload: TelemetryAggregateResponse = {
      sessionId: session.id,
      protocol: session.protocol === "DASH" ? "DASH" : "HLS",
      averageBufferingRatio: Number((totalBufferTime / totalDurationSeconds).toFixed(4)),
      totalStallCount,
      finalBitrate,
      ttff,
    }

    return res.json(payload)
  } catch (error) {
    console.error("Failed to aggregate session telemetry", error)
    return res.status(500).json({ error: "Failed to aggregate telemetry" })
  }
})

app.get("/api/sessions/:id/timeline", async (req, res) => {
  try {
    const { id } = req.params
    const session = await prisma.playbackSession.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!session) {
      return res.status(404).json({ error: "Session not found" })
    }

    const telemetry = await prisma.telemetryLog.findMany({
      where: { sessionId: id },
      orderBy: { timestamp: "asc" },
      select: {
        timestamp: true,
        bitrate: true,
        bufferLength: true,
      },
      take: 1000,
    })

    const payload: TelemetryTimelineResponse = {
      sessionId: id,
      points: telemetry.map((entry) => ({
        timestamp: entry.timestamp.toISOString(),
        currentBitrate: entry.bitrate,
        forwardBufferLength: entry.bufferLength,
      })),
    }

    return res.json(payload)
  } catch (error) {
    console.error("Failed to load telemetry timeline", error)
    return res.status(500).json({ error: "Failed to load telemetry timeline" })
  }
})

const httpServer = createServer(app)
const wsServer = new WebSocketServer({ server: httpServer })

wsServer.on("connection", (socket: WebSocket) => {
  const state: SocketState = {
    sessionId: null,
  }

  socket.on("message", async (rawData, isBinary) => {
    if (isBinary) return

    const message = parseMessage(rawData.toString())
    if (!message) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid payload" }))
      return
    }

    try {
      if (isInitMessage(message)) {
        const session = await prisma.playbackSession.create({
          data: {
            streamUrl: message.streamUrl,
            protocol: message.protocol,
          },
        })
        state.sessionId = session.id
        const ack: TelemetryInitAckMessage = {
          type: "init_ack",
          sessionId: session.id,
        }
        socket.send(JSON.stringify(ack))
        return
      }

      if (isBatchMessage(message)) {
        const sessionId = message.sessionId || state.sessionId
        if (!sessionId) {
          socket.send(JSON.stringify({ type: "error", message: "Session not initialized" }))
          return
        }
        if (!Array.isArray(message.logs) || message.logs.length === 0) return

        await prisma.telemetryLog.createMany({
          data: message.logs.map((entry) => ({
            sessionId,
            ...normalizeLogEntry(entry),
          })),
        })
      }
    } catch (error) {
      console.error("Failed to handle websocket telemetry", error)
      socket.send(JSON.stringify({ type: "error", message: "Telemetry ingestion failed" }))
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`StreamOptics backend listening on http://localhost:${PORT}`)
})
