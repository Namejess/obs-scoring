import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import { createMatchRoutes } from '../../src/routes/matches.js'
import { prisma } from '../setup.js'

// Create a test app
function createTestApp() {
  const app = express()
  const httpServer = createServer(app)
  const io = new SocketIOServer(httpServer)

  app.use(express.json())
  app.use('/matches', createMatchRoutes(io))

  return { app, io, httpServer }
}

describe('Matches API Integration', () => {
  const { app, httpServer } = createTestApp()

  afterAll(() => {
    httpServer.close()
  })

  beforeEach(async () => {
    await prisma.match.deleteMany()
  })

  describe('POST /matches', () => {
    it('should create a new match', async () => {
      const res = await request(app)
        .post('/matches')
        .send({ player1: 'Alice', player2: 'Bob' })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        player1: 'Alice',
        player2: 'Bob',
        player1Score: 0,
        player2Score: 0,
      })
    })

    it('should create match with teams', async () => {
      const res = await request(app)
        .post('/matches')
        .send({ player1: 'Alice', player2: 'Bob', team1: 'Red', team2: 'Blue' })

      expect(res.status).toBe(201)
      expect(res.body.team1).toBe('Red')
      expect(res.body.team2).toBe('Blue')
    })

    it('should reject invalid data', async () => {
      const res = await request(app).post('/matches').send({ player1: 'Alice' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBeDefined()
    })
  })

  describe('GET /matches', () => {
    it('should return all matches', async () => {
      await request(app).post('/matches').send({ player1: 'A', player2: 'B' })
      await request(app).post('/matches').send({ player1: 'C', player2: 'D' })

      const res = await request(app).get('/matches')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
    })
  })

  describe('GET /matches/:id', () => {
    it('should return match by ID', async () => {
      const createRes = await request(app)
        .post('/matches')
        .send({ player1: 'A', player2: 'B' })

      const res = await request(app).get(`/matches/${createRes.body.id}`)

      expect(res.status).toBe(200)
      expect(res.body.player1).toBe('A')
    })

    it('should return 404 for non-existent match', async () => {
      const res = await request(app).get('/matches/99999')

      expect(res.status).toBe(404)
    })

    it('should return 400 for invalid ID', async () => {
      const res = await request(app).get('/matches/invalid')

      expect(res.status).toBe(400)
    })
  })

  describe('GET /matches/current', () => {
    it('should return 404 when no current match', async () => {
      const res = await request(app).get('/matches/current')

      expect(res.status).toBe(404)
    })

    it('should return current match', async () => {
      const createRes = await request(app)
        .post('/matches')
        .send({ player1: 'A', player2: 'B' })

      await request(app).patch(`/matches/${createRes.body.id}/setCurrent`)

      const res = await request(app).get('/matches/current')

      expect(res.status).toBe(200)
      expect(res.body.isCurrent).toBe(true)
    })
  })

  describe('GET /matches/obsData', () => {
    it('should return empty data when no current match', async () => {
      const res = await request(app).get('/matches/obsData')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        players: [
          { name: '', team: null, score: 0 },
          { name: '', team: null, score: 0 },
        ],
        matchId: null,
      })
    })

    it('should return formatted OBS data', async () => {
      const createRes = await request(app)
        .post('/matches')
        .send({ player1: 'Alice', player2: 'Bob', team1: 'Red', team2: 'Blue' })

      await request(app).patch(`/matches/${createRes.body.id}/setCurrent`)
      await request(app)
        .patch(`/matches/${createRes.body.id}`)
        .send({ player1Score: 3, player2Score: 1 })

      const res = await request(app).get('/matches/obsData')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        players: [
          { name: 'Alice', team: 'Red', score: 3 },
          { name: 'Bob', team: 'Blue', score: 1 },
        ],
      })
    })
  })

  describe('PATCH /matches/:id', () => {
    it('should update scores', async () => {
      const createRes = await request(app)
        .post('/matches')
        .send({ player1: 'A', player2: 'B' })

      const res = await request(app)
        .patch(`/matches/${createRes.body.id}`)
        .send({ player1Score: 5, player2Score: 3 })

      expect(res.status).toBe(200)
      expect(res.body.player1Score).toBe(5)
      expect(res.body.player2Score).toBe(3)
    })

    it('should reject negative scores', async () => {
      const createRes = await request(app)
        .post('/matches')
        .send({ player1: 'A', player2: 'B' })

      const res = await request(app)
        .patch(`/matches/${createRes.body.id}`)
        .send({ player1Score: -1, player2Score: 0 })

      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /matches/:id/setCurrent', () => {
    it('should set match as current', async () => {
      const createRes = await request(app)
        .post('/matches')
        .send({ player1: 'A', player2: 'B' })

      const res = await request(app).patch(`/matches/${createRes.body.id}/setCurrent`)

      expect(res.status).toBe(200)
      expect(res.body.isCurrent).toBe(true)
    })

    it('should unset previous current match', async () => {
      const match1 = await request(app).post('/matches').send({ player1: 'A', player2: 'B' })
      const match2 = await request(app).post('/matches').send({ player1: 'C', player2: 'D' })

      await request(app).patch(`/matches/${match1.body.id}/setCurrent`)
      await request(app).patch(`/matches/${match2.body.id}/setCurrent`)

      const res1 = await request(app).get(`/matches/${match1.body.id}`)
      const res2 = await request(app).get(`/matches/${match2.body.id}`)

      expect(res1.body.isCurrent).toBe(false)
      expect(res2.body.isCurrent).toBe(true)
    })
  })

  describe('DELETE /matches/:id', () => {
    it('should delete match', async () => {
      const createRes = await request(app)
        .post('/matches')
        .send({ player1: 'A', player2: 'B' })

      const res = await request(app).delete(`/matches/${createRes.body.id}`)

      expect(res.status).toBe(204)

      const getRes = await request(app).get(`/matches/${createRes.body.id}`)
      expect(getRes.status).toBe(404)
    })

    it('should return 404 for non-existent match', async () => {
      const res = await request(app).delete('/matches/99999')

      expect(res.status).toBe(404)
    })
  })
})
