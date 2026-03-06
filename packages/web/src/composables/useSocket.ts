import { ref, readonly, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ConnectionStatus,
  ScoreUpdateEvent,
  MatchCreatedEvent,
  MatchDeletedEvent,
  CurrentMatchChangedEvent,
} from '@obs-scoring/shared'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

// Singleton socket instance
let socket: TypedSocket | null = null
let connectionStatus = ref<ConnectionStatus>('disconnected')
let reconnectAttempts = ref(0)

// Event callbacks registry
type EventCallbacks = {
  scoreUpdate: Set<(event: ScoreUpdateEvent) => void>
  matchCreated: Set<(event: MatchCreatedEvent) => void>
  matchDeleted: Set<(event: MatchDeletedEvent) => void>
  currentMatchChanged: Set<(event: CurrentMatchChangedEvent) => void>
}

const callbacks: EventCallbacks = {
  scoreUpdate: new Set(),
  matchCreated: new Set(),
  matchDeleted: new Set(),
  currentMatchChanged: new Set(),
}

function initSocket(): TypedSocket {
  if (socket) return socket

  socket = io(WS_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  })

  socket.on('connect', () => {
    connectionStatus.value = 'connected'
    reconnectAttempts.value = 0
    console.log('[Socket] Connected')
  })

  socket.on('disconnect', () => {
    connectionStatus.value = 'disconnected'
    console.log('[Socket] Disconnected')
  })

  socket.io.on('reconnect_attempt', (attempt) => {
    connectionStatus.value = 'reconnecting'
    reconnectAttempts.value = attempt
    console.log(`[Socket] Reconnecting... attempt ${attempt}`)
  })

  socket.io.on('reconnect', () => {
    connectionStatus.value = 'connected'
    reconnectAttempts.value = 0
    console.log('[Socket] Reconnected')
  })

  socket.io.on('reconnect_failed', () => {
    connectionStatus.value = 'disconnected'
    console.log('[Socket] Reconnection failed')
  })

  // Forward events to registered callbacks
  socket.on('scoreUpdate', (event) => {
    callbacks.scoreUpdate.forEach((cb) => cb(event))
  })

  socket.on('matchCreated', (event) => {
    callbacks.matchCreated.forEach((cb) => cb(event))
  })

  socket.on('matchDeleted', (event) => {
    callbacks.matchDeleted.forEach((cb) => cb(event))
  })

  socket.on('currentMatchChanged', (event) => {
    callbacks.currentMatchChanged.forEach((cb) => cb(event))
  })

  return socket
}

export function useSocket() {
  const socket = initSocket()

  function onScoreUpdate(callback: (event: ScoreUpdateEvent) => void) {
    callbacks.scoreUpdate.add(callback)
    onUnmounted(() => {
      callbacks.scoreUpdate.delete(callback)
    })
  }

  function onMatchCreated(callback: (event: MatchCreatedEvent) => void) {
    callbacks.matchCreated.add(callback)
    onUnmounted(() => {
      callbacks.matchCreated.delete(callback)
    })
  }

  function onMatchDeleted(callback: (event: MatchDeletedEvent) => void) {
    callbacks.matchDeleted.add(callback)
    onUnmounted(() => {
      callbacks.matchDeleted.delete(callback)
    })
  }

  function onCurrentMatchChanged(callback: (event: CurrentMatchChangedEvent) => void) {
    callbacks.currentMatchChanged.add(callback)
    onUnmounted(() => {
      callbacks.currentMatchChanged.delete(callback)
    })
  }

  return {
    socket,
    status: readonly(connectionStatus),
    reconnectAttempts: readonly(reconnectAttempts),
    isConnected: () => connectionStatus.value === 'connected',
    isReconnecting: () => connectionStatus.value === 'reconnecting',
    onScoreUpdate,
    onMatchCreated,
    onMatchDeleted,
    onCurrentMatchChanged,
  }
}
