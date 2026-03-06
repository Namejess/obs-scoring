import type { Match } from './match.js'

/**
 * Event emitted when a match score is updated
 */
export interface ScoreUpdateEvent {
  matchId: number
  player1Score: number
  player2Score: number
}

/**
 * Event emitted when the current match changes
 */
export interface CurrentMatchChangedEvent {
  match: Match | null
}

/**
 * Event emitted when a match is created
 */
export interface MatchCreatedEvent {
  match: Match
}

/**
 * Event emitted when a match is deleted
 */
export interface MatchDeletedEvent {
  id: number
}

/**
 * Socket.io event map - Server to Client events
 */
export interface ServerToClientEvents {
  scoreUpdate: (event: ScoreUpdateEvent) => void
  matchCreated: (event: MatchCreatedEvent) => void
  matchDeleted: (event: MatchDeletedEvent) => void
  currentMatchChanged: (event: CurrentMatchChangedEvent) => void
}

/**
 * Socket.io event map - Client to Server events
 */
export interface ClientToServerEvents {
  // Currently no client-to-server events needed
  // Score updates go through REST API to ensure validation
}

/**
 * Socket.io inter-server events (for scaling)
 */
export interface InterServerEvents {
  // Reserved for future horizontal scaling
}

/**
 * Socket.io socket data
 */
export interface SocketData {
  // Reserved for future per-socket data
}
