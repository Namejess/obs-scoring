// Match types
export type {
  Match,
  CreateMatchDto,
  UpdateScoreDto,
  OBSPlayerData,
  OBSOverlayData,
  OverlayConfig,
} from './types/match.js'
export { DEFAULT_OVERLAY_CONFIG } from './types/match.js'

// Socket types
export type {
  ScoreUpdateEvent,
  CurrentMatchChangedEvent,
  MatchCreatedEvent,
  MatchDeletedEvent,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types/socket.js'

// API types
export type {
  ApiError,
  ApiListResponse,
  ConnectionStatus,
  ServerInfo,
} from './types/api.js'
