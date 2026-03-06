import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
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
import { getApiUrl } from '../services/storage'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface SocketContextType {
  status: ConnectionStatus
  reconnectAttempts: number
  connect: () => Promise<void>
  disconnect: () => void
  onScoreUpdate: (callback: (event: ScoreUpdateEvent) => void) => () => void
  onMatchCreated: (callback: (event: MatchCreatedEvent) => void) => () => void
  onMatchDeleted: (callback: (event: MatchDeletedEvent) => void) => () => void
  onCurrentMatchChanged: (callback: (event: CurrentMatchChangedEvent) => void) => () => void
}

const SocketContext = createContext<SocketContextType | null>(null)

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<TypedSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const connect = useCallback(async () => {
    const url = await getApiUrl()
    if (!url) {
      console.log('[Socket] No API URL configured')
      return
    }

    if (socket) {
      socket.disconnect()
    }

    const newSocket: TypedSocket = io(url, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })

    newSocket.on('connect', () => {
      setStatus('connected')
      setReconnectAttempts(0)
      console.log('[Socket] Connected')
    })

    newSocket.on('disconnect', () => {
      setStatus('disconnected')
      console.log('[Socket] Disconnected')
    })

    newSocket.io.on('reconnect_attempt', (attempt) => {
      setStatus('reconnecting')
      setReconnectAttempts(attempt)
      console.log(`[Socket] Reconnecting... attempt ${attempt}`)
    })

    newSocket.io.on('reconnect', () => {
      setStatus('connected')
      setReconnectAttempts(0)
      console.log('[Socket] Reconnected')
    })

    setSocket(newSocket)
  }, [socket])

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
      setStatus('disconnected')
    }
  }, [socket])

  const createEventHandler = useCallback(
    <T extends keyof ServerToClientEvents>(event: T) => {
      return (callback: ServerToClientEvents[T]) => {
        if (!socket) return () => {}
        socket.on(event, callback as any)
        return () => {
          socket.off(event, callback as any)
        }
      }
    },
    [socket]
  )

  const onScoreUpdate = useCallback(
    (callback: (event: ScoreUpdateEvent) => void) => createEventHandler('scoreUpdate')(callback),
    [createEventHandler]
  )

  const onMatchCreated = useCallback(
    (callback: (event: MatchCreatedEvent) => void) => createEventHandler('matchCreated')(callback),
    [createEventHandler]
  )

  const onMatchDeleted = useCallback(
    (callback: (event: MatchDeletedEvent) => void) => createEventHandler('matchDeleted')(callback),
    [createEventHandler]
  )

  const onCurrentMatchChanged = useCallback(
    (callback: (event: CurrentMatchChangedEvent) => void) =>
      createEventHandler('currentMatchChanged')(callback),
    [createEventHandler]
  )

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [socket])

  return (
    <SocketContext.Provider
      value={{
        status,
        reconnectAttempts,
        connect,
        disconnect,
        onScoreUpdate,
        onMatchCreated,
        onMatchDeleted,
        onCurrentMatchChanged,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
