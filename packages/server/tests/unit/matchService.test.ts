import { describe, it, expect, beforeEach, vi } from 'vitest'
import { matchService } from '../../src/services/matchService.js'
import { prisma } from '../setup.js'

describe('matchService', () => {
  beforeEach(async () => {
    await prisma.match.deleteMany()
  })

  describe('create', () => {
    it('should create a match with required fields', async () => {
      const match = await matchService.create({
        player1: 'Alice',
        player2: 'Bob',
      })

      expect(match).toMatchObject({
        player1: 'Alice',
        player2: 'Bob',
        player1Score: 0,
        player2Score: 0,
        isCurrent: false,
        team1: null,
        team2: null,
      })
      expect(match.id).toBeDefined()
      expect(match.createdAt).toBeDefined()
    })

    it('should create a match with optional team names', async () => {
      const match = await matchService.create({
        player1: 'Alice',
        player2: 'Bob',
        team1: 'Team Red',
        team2: 'Team Blue',
      })

      expect(match.team1).toBe('Team Red')
      expect(match.team2).toBe('Team Blue')
    })
  })

  describe('findAll', () => {
    it('should return empty array when no matches exist', async () => {
      const matches = await matchService.findAll()
      expect(matches).toEqual([])
    })

    it('should return all matches ordered by creation date desc', async () => {
      await matchService.create({ player1: 'A', player2: 'B' })
      await matchService.create({ player1: 'C', player2: 'D' })

      const matches = await matchService.findAll()

      expect(matches).toHaveLength(2)
      expect(matches[0]?.player1).toBe('C') // newest first
      expect(matches[1]?.player1).toBe('A')
    })
  })

  describe('findById', () => {
    it('should return match by ID', async () => {
      const created = await matchService.create({ player1: 'A', player2: 'B' })
      const found = await matchService.findById(created.id)

      expect(found).toMatchObject({
        id: created.id,
        player1: 'A',
        player2: 'B',
      })
    })

    it('should return null for non-existent ID', async () => {
      const found = await matchService.findById(99999)
      expect(found).toBeNull()
    })
  })

  describe('findCurrent', () => {
    it('should return null when no current match', async () => {
      await matchService.create({ player1: 'A', player2: 'B' })
      const current = await matchService.findCurrent()
      expect(current).toBeNull()
    })

    it('should return the current match', async () => {
      const match = await matchService.create({ player1: 'A', player2: 'B' })
      await matchService.setCurrent(match.id)

      const current = await matchService.findCurrent()

      expect(current).toMatchObject({
        id: match.id,
        isCurrent: true,
      })
    })
  })

  describe('updateScore', () => {
    it('should update match scores', async () => {
      const match = await matchService.create({ player1: 'A', player2: 'B' })

      const updated = await matchService.updateScore(match.id, {
        player1Score: 3,
        player2Score: 2,
      })

      expect(updated).toMatchObject({
        id: match.id,
        player1Score: 3,
        player2Score: 2,
      })
    })

    it('should return null for non-existent match', async () => {
      const updated = await matchService.updateScore(99999, {
        player1Score: 1,
        player2Score: 1,
      })
      expect(updated).toBeNull()
    })
  })

  describe('setCurrent', () => {
    it('should set match as current and unset others', async () => {
      const match1 = await matchService.create({ player1: 'A', player2: 'B' })
      const match2 = await matchService.create({ player1: 'C', player2: 'D' })

      await matchService.setCurrent(match1.id)
      await matchService.setCurrent(match2.id)

      const m1 = await matchService.findById(match1.id)
      const m2 = await matchService.findById(match2.id)

      expect(m1?.isCurrent).toBe(false)
      expect(m2?.isCurrent).toBe(true)
    })

    it('should return null for non-existent match', async () => {
      const result = await matchService.setCurrent(99999)
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete a match', async () => {
      const match = await matchService.create({ player1: 'A', player2: 'B' })

      const deleted = await matchService.delete(match.id)

      expect(deleted).toBe(true)
      expect(await matchService.findById(match.id)).toBeNull()
    })

    it('should return false for non-existent match', async () => {
      const deleted = await matchService.delete(99999)
      expect(deleted).toBe(false)
    })
  })

  describe('getOBSData', () => {
    it('should return empty data when no current match', async () => {
      const data = await matchService.getOBSData()

      expect(data).toEqual({
        players: [
          { name: '', team: null, score: 0 },
          { name: '', team: null, score: 0 },
        ],
        matchId: null,
      })
    })

    it('should return formatted OBS data for current match', async () => {
      const match = await matchService.create({
        player1: 'Alice',
        player2: 'Bob',
        team1: 'Red',
        team2: 'Blue',
      })
      await matchService.setCurrent(match.id)
      await matchService.updateScore(match.id, { player1Score: 2, player2Score: 1 })

      const data = await matchService.getOBSData()

      expect(data).toEqual({
        players: [
          { name: 'Alice', team: 'Red', score: 2 },
          { name: 'Bob', team: 'Blue', score: 1 },
        ],
        matchId: match.id,
      })
    })
  })
})
