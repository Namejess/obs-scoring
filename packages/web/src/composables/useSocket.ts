import { ref, readonly, onUnmounted } from 'vue'
import type {
  ScoreUpdateEvent,
  MatchCreatedEvent,
  MatchDeletedEvent,
  CurrentMatchChangedEvent,
  ConnectionStatus,
} from '@obs-scoring/shared'

// ─── Config ───────────────────────────────────────────────────────────────────

// Axum WebSocket endpoint — port 3002
const BASE_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3002'
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws'

// ─── Singleton state ──────────────────────────────────────────────────────────

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 1000 // starts at 1s, doubles up to 30s

const connectionStatus = ref<ConnectionStatus>('disconnected')
const reconnectAttempts = ref(0)

// ─── Event callbacks registry (same shape as before) ─────────────────────────

type EventCallbacks = {
  scoreUpdate: Set<(event: ScoreUpdateEvent) => void>
  matchCreated: Set<(event: MatchCreatedEvent) => void>
  matchDeleted: Set<(event: MatchDeletedEvent) => void>
  currentMatchChanged: Set<(event: CurrentMatchChangedEvent) => void>
  startggSetsUpdated: Set<(event: { sets: unknown[] }) => void>
}

const callbacks: EventCallbacks = {
  scoreUpdate: new Set(),
  matchCreated: new Set(),
  matchDeleted: new Set(),
  currentMatchChanged: new Set(),
  startggSetsUpdated: new Set(),
}

// ─── Message dispatcher ───────────────────────────────────────────────────────
// Axum sends: { event: "scoreUpdate", data: { ... } }

function handleMessage(raw: string) {
  let msg: { event: string; data: unknown }
  try {
    msg = JSON.parse(raw)
  } catch {
    console.warn('[WS] Failed to parse message:', raw)
    return
  }

  switch (msg.event) {
    case 'scoreUpdate':
      callbacks.scoreUpdate.forEach((cb) => cb(msg.data as ScoreUpdateEvent))
      break
    case 'matchCreated':
      callbacks.matchCreated.forEach((cb) => cb(msg.data as MatchCreatedEvent))
      break
    case 'matchDeleted':
      callbacks.matchDeleted.forEach((cb) => cb(msg.data as MatchDeletedEvent))
      break
    case 'currentMatchChanged':
      callbacks.currentMatchChanged.forEach((cb) => cb(msg.data as CurrentMatchChangedEvent))
      break
    case 'startggSetsUpdated':
      callbacks.startggSetsUpdated.forEach((cb) => cb(msg.data as { sets: unknown[] }))
      break
    default:
      console.debug('[WS] Unknown event:', msg.event)
  }
}

// ─── Reconnect logic with exponential backoff ─────────────────────────────────

function scheduleReconnect() {
  if (reconnectTimer !== null) return

  connectionStatus.value = 'reconnecting'
  reconnectAttempts.value += 1
  console.log(`[WS] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts.value})`)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    initSocket()
  }, reconnectDelay)

  // Exponential backoff: 1s → 2s → 4s → ... → 30s max
  reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
}

// ─── Socket init ──────────────────────────────────────────────────────────────

function initSocket(): WebSocket {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws
  }

  console.log('[WS] Connecting to', WS_URL)
  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    connectionStatus.value = 'connected'
    reconnectAttempts.value = 0
    reconnectDelay = 1000 // reset backoff
    console.log('[WS] Connected')
  }

  ws.onclose = (event) => {
    connectionStatus.value = 'disconnected'
    console.log('[WS] Disconnected', event.code, event.reason)
    scheduleReconnect()
  }

  ws.onerror = (err) => {
    console.error('[WS] Error', err)
    // onclose will fire next and trigger reconnect
  }

  ws.onmessage = (event) => {
    handleMessage(event.data)
  }

  return ws
}

// ─── Public composable ────────────────────────────────────────────────────────

export function useSocket() {
  // Ensure singleton is initialized
  initSocket()

  function onScoreUpdate(callback: (event: ScoreUpdateEvent) => void) {
    callbacks.scoreUpdate.add(callback)
    onUnmounted(() => callbacks.scoreUpdate.delete(callback))
  }

  function onMatchCreated(callback: (event: MatchCreatedEvent) => void) {
    callbacks.matchCreated.add(callback)
    onUnmounted(() => callbacks.matchCreated.delete(callback))
  }

  function onMatchDeleted(callback: (event: MatchDeletedEvent) => void) {
    callbacks.matchDeleted.add(callback)
    onUnmounted(() => callbacks.matchDeleted.delete(callback))
  }

  function onCurrentMatchChanged(callback: (event: CurrentMatchChangedEvent) => void) {
    callbacks.currentMatchChanged.add(callback)
    onUnmounted(() => callbacks.currentMatchChanged.delete(callback))
  }

  function onStartggSetsUpdated(callback: (event: { sets: unknown[] }) => void) {
    callbacks.startggSetsUpdated.add(callback)
    onUnmounted(() => callbacks.startggSetsUpdated.delete(callback))
  }

  return {
    // Expose the raw WS instance for consumers that need it (replaces TypedSocket)
    socket: ws,
    status: readonly(connectionStatus),
    reconnectAttempts: readonly(reconnectAttempts),
    isConnected: () => connectionStatus.value === 'connected',
    isReconnecting: () => connectionStatus.value === 'reconnecting',
    onScoreUpdate,
    onMatchCreated,
    onMatchDeleted,
    onCurrentMatchChanged,
    onStartggSetsUpdated,
  }
}
