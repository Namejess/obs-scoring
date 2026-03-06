/**
 * Match entity - represents a match between two players
 */
export interface Match {
  id: number
  player1: string
  player2: string
  team1: string | null
  team2: string | null
  player1Score: number
  player2Score: number
  isCurrent: boolean
  createdAt: string // ISO 8601 date string
}

/**
 * DTO for creating a new match
 */
export interface CreateMatchDto {
  player1: string
  player2: string
  team1?: string
  team2?: string
}

/**
 * DTO for updating match scores
 */
export interface UpdateScoreDto {
  player1Score: number
  player2Score: number
}

/**
 * Player data formatted for OBS overlay display
 */
export interface OBSPlayerData {
  name: string
  team: string | null
  score: number
}

/**
 * Data structure optimized for OBS overlay consumption
 * This is what the /matches/obsData endpoint returns
 */
export interface OBSOverlayData {
  players: [OBSPlayerData, OBSPlayerData]
  matchId: number | null
}

/**
 * Overlay configuration options (passed via URL params)
 */
export interface OverlayConfig {
  textColor: string
  bgColor: string
  fontSize: number
  fontFamily: string
  showTeams: boolean
  layout: 'horizontal' | 'vertical'
}

/**
 * Default overlay configuration
 */
export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  textColor: 'ffffff',
  bgColor: 'transparent',
  fontSize: 48,
  fontFamily: 'Inter',
  showTeams: true,
  layout: 'horizontal',
}
