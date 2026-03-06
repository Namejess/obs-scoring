import { Router, type Request, type Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@obs-scoring/shared'
import { matchService } from '../services/matchService.js'
import { createMatchSchema, updateScoreSchema, idParamSchema } from '../lib/validation.js'

type TypedIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

export function createMatchRoutes(io: TypedIO): Router {
  const router = Router()

  /**
   * @swagger
   * components:
   *   schemas:
   *     Match:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *         player1:
   *           type: string
   *         player2:
   *           type: string
   *         team1:
   *           type: string
   *           nullable: true
   *         team2:
   *           type: string
   *           nullable: true
   *         player1Score:
   *           type: integer
   *         player2Score:
   *           type: integer
   *         isCurrent:
   *           type: boolean
   *         createdAt:
   *           type: string
   *           format: date-time
   *     CreateMatch:
   *       type: object
   *       required:
   *         - player1
   *         - player2
   *       properties:
   *         player1:
   *           type: string
   *         player2:
   *           type: string
   *         team1:
   *           type: string
   *         team2:
   *           type: string
   *     UpdateScore:
   *       type: object
   *       required:
   *         - player1Score
   *         - player2Score
   *       properties:
   *         player1Score:
   *           type: integer
   *         player2Score:
   *           type: integer
   *     OBSOverlayData:
   *       type: object
   *       properties:
   *         players:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               team:
   *                 type: string
   *                 nullable: true
   *               score:
   *                 type: integer
   *         matchId:
   *           type: integer
   *           nullable: true
   */

  /**
   * @swagger
   * /matches:
   *   get:
   *     summary: Get all matches
   *     tags: [Matches]
   *     responses:
   *       200:
   *         description: List of all matches
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Match'
   */
  router.get('/', async (_req: Request, res: Response) => {
    const matches = await matchService.findAll()
    res.json(matches)
  })

  /**
   * @swagger
   * /matches/current:
   *   get:
   *     summary: Get the current match
   *     tags: [Matches]
   *     responses:
   *       200:
   *         description: The current match
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Match'
   *       404:
   *         description: No current match set
   */
  router.get('/current', async (_req: Request, res: Response) => {
    const match = await matchService.findCurrent()
    if (!match) {
      res.status(404).json({ error: 'No current match set' })
      return
    }
    res.json(match)
  })

  /**
   * @swagger
   * /matches/obsData:
   *   get:
   *     summary: Get OBS overlay data for current match
   *     description: Returns data formatted for OBS URL/API Source plugin
   *     tags: [OBS]
   *     responses:
   *       200:
   *         description: OBS overlay data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OBSOverlayData'
   */
  router.get('/obsData', async (_req: Request, res: Response) => {
    const data = await matchService.getOBSData()
    res.json(data)
  })

  /**
   * @swagger
   * /matches/{id}:
   *   get:
   *     summary: Get a match by ID
   *     tags: [Matches]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The match
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Match'
   *       404:
   *         description: Match not found
   */
  router.get('/:id', async (req: Request, res: Response) => {
    const { error, value } = idParamSchema.validate({ id: parseInt(req.params.id ?? '', 10) })
    if (error) {
      res.status(400).json({ error: error.details[0]?.message })
      return
    }

    const match = await matchService.findById(value.id)
    if (!match) {
      res.status(404).json({ error: 'Match not found' })
      return
    }
    res.json(match)
  })

  /**
   * @swagger
   * /matches:
   *   post:
   *     summary: Create a new match
   *     tags: [Matches]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateMatch'
   *     responses:
   *       201:
   *         description: Match created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Match'
   *       400:
   *         description: Validation error
   */
  router.post('/', async (req: Request, res: Response) => {
    const { error, value } = createMatchSchema.validate(req.body)
    if (error) {
      res.status(400).json({ error: error.details[0]?.message })
      return
    }

    const match = await matchService.create(value)
    io.emit('matchCreated', { match })
    res.status(201).json(match)
  })

  /**
   * @swagger
   * /matches/{id}:
   *   patch:
   *     summary: Update match scores
   *     tags: [Matches]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateScore'
   *     responses:
   *       200:
   *         description: Match updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Match'
   *       404:
   *         description: Match not found
   */
  router.patch('/:id', async (req: Request, res: Response) => {
    const { error: idError, value: idValue } = idParamSchema.validate({
      id: parseInt(req.params.id ?? '', 10),
    })
    if (idError) {
      res.status(400).json({ error: idError.details[0]?.message })
      return
    }

    const { error, value } = updateScoreSchema.validate(req.body)
    if (error) {
      res.status(400).json({ error: error.details[0]?.message })
      return
    }

    const match = await matchService.updateScore(idValue.id, value)
    if (!match) {
      res.status(404).json({ error: 'Match not found' })
      return
    }

    io.emit('scoreUpdate', {
      matchId: match.id,
      player1Score: match.player1Score,
      player2Score: match.player2Score,
    })

    res.json(match)
  })

  /**
   * @swagger
   * /matches/{id}/setCurrent:
   *   patch:
   *     summary: Set a match as the current match
   *     tags: [Matches]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Match set as current
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Match'
   *       404:
   *         description: Match not found
   */
  router.patch('/:id/setCurrent', async (req: Request, res: Response) => {
    const { error, value } = idParamSchema.validate({ id: parseInt(req.params.id ?? '', 10) })
    if (error) {
      res.status(400).json({ error: error.details[0]?.message })
      return
    }

    const match = await matchService.setCurrent(value.id)
    if (!match) {
      res.status(404).json({ error: 'Match not found' })
      return
    }

    io.emit('currentMatchChanged', { match })

    res.json(match)
  })

  /**
   * @swagger
   * /matches/{id}:
   *   delete:
   *     summary: Delete a match
   *     tags: [Matches]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       204:
   *         description: Match deleted
   *       404:
   *         description: Match not found
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    const { error, value } = idParamSchema.validate({ id: parseInt(req.params.id ?? '', 10) })
    if (error) {
      res.status(400).json({ error: error.details[0]?.message })
      return
    }

    const deleted = await matchService.delete(value.id)
    if (!deleted) {
      res.status(404).json({ error: 'Match not found' })
      return
    }

    io.emit('matchDeleted', { id: value.id })

    res.status(204).send()
  })

  return router
}
