export type StreamingProtocol = "HLS" | "DASH"

export interface TelemetryInitMessage {
  type: "init"
  streamUrl: string
  protocol: StreamingProtocol
}

export interface TelemetryInitAckMessage {
  type: "init_ack"
  sessionId: string
}

export interface TelemetryLogEntry {
  timestamp: string
  currentBitrate: number
  forwardBufferLength: number
  totalBufferDuration: number
  ttff: number
  bufferCount: number
}

export interface TelemetryBatchMessage {
  type: "telemetry_batch"
  sessionId: string
  logs: TelemetryLogEntry[]
}

export interface TelemetryAggregateResponse {
  sessionId: string
  protocol: StreamingProtocol
  averageBufferingRatio: number
  totalStallCount: number
  finalBitrate: number
  ttff: number
}

export interface SessionSummary {
  sessionId: string
  streamUrl: string
  protocol: StreamingProtocol
  createdAt: string
}

export interface TelemetryTimelinePoint {
  timestamp: string
  currentBitrate: number
  forwardBufferLength: number
}

export interface TelemetryTimelineResponse {
  sessionId: string
  points: TelemetryTimelinePoint[]
}

export type TelemetryClientMessage = TelemetryInitMessage | TelemetryBatchMessage
export type TelemetryServerMessage = TelemetryInitAckMessage
