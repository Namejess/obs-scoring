/**
 * API error response format
 */
export interface ApiError {
  error: string
  message: string
  statusCode: number
  details?: Record<string, unknown>
}

/**
 * API success response for list operations
 */
export interface ApiListResponse<T> {
  data: T[]
  count: number
}

/**
 * Connection status for real-time features
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting'

/**
 * Server info response (for mobile app connection test)
 */
export interface ServerInfo {
  name: string
  version: string
  status: 'ok'
}
