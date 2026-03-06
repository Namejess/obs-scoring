import type { Match as SharedMatch, CreateMatchDto, UpdateScoreDto, OBSOverlayData } from '@obs-scoring/shared'
import prisma from '../lib/prisma.js'

// Convert Prisma Match to shared Match type (Date to string)
function toSharedMatch(match: {
  id: number
  player1: string
  player2: string
  team1: string | null
  team2: string | null
  player1Score: number
  player2Score: number
  isCurrent: boolean
  createdAt: Date
}): SharedMatch {
  return {
    ...match,
    createdAt: match.createdAt.toISOString(),
  }
}

export const matchService = {
  /**
   * Get all matches, ordered by creation date (newest first)
   */
  async findAll(): Promise<SharedMatch[]> {
    const matches = await prisma.match.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return matches.map(toSharedMatch)
  },

  /**
   * Get a single match by ID
   */
  async findById(id: number): Promise<SharedMatch | null> {
    const match = await prisma.match.findUnique({
      where: { id },
    })
    return match ? toSharedMatch(match) : null
  },

  /**
   * Get the current match (isCurrent = true)
   */
  async findCurrent(): Promise<SharedMatch | null> {
    const match = await prisma.match.findFirst({
      where: { isCurrent: true },
    })
    return match ? toSharedMatch(match) : null
  },

  /**
   * Get OBS overlay data for the current match
   */
  async getOBSData(): Promise<OBSOverlayData> {
    const match = await prisma.match.findFirst({
      where: { isCurrent: true },
    })

    if (!match) {
      return {
        players: [
          { name: '', team: null, score: 0 },
          { name: '', team: null, score: 0 },
        ],
        matchId: null,
      }
    }

    return {
      players: [
        { name: match.player1, team: match.team1, score: match.player1Score },
        { name: match.player2, team: match.team2, score: match.player2Score },
      ],
      matchId: match.id,
    }
  },

  /**
   * Create a new match
   */
  async create(data: CreateMatchDto): Promise<SharedMatch> {
    const match = await prisma.match.create({
      data: {
        player1: data.player1,
        player2: data.player2,
        team1: data.team1 ?? null,
        team2: data.team2 ?? null,
      },
    })
    return toSharedMatch(match)
  },

  /**
   * Update match scores
   */
  async updateScore(id: number, data: UpdateScoreDto): Promise<SharedMatch | null> {
    try {
      const match = await prisma.match.update({
        where: { id },
        data: {
          player1Score: data.player1Score,
          player2Score: data.player2Score,
        },
      })
      return toSharedMatch(match)
    } catch {
      return null
    }
  },

  /**
   * Set a match as the current match (unsets all others)
   */
  async setCurrent(id: number): Promise<SharedMatch | null> {
    // First, unset all matches
    await prisma.match.updateMany({
      data: { isCurrent: false },
    })

    // Then set the target match as current
    try {
      const match = await prisma.match.update({
        where: { id },
        data: { isCurrent: true },
      })
      return toSharedMatch(match)
    } catch {
      return null
    }
  },

  /**
   * Delete a match
   */
  async delete(id: number): Promise<boolean> {
    try {
      await prisma.match.delete({
        where: { id },
      })
      return true
    } catch {
      return false
    }
  },
}

export type MatchService = typeof matchService
