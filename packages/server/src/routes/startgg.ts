import { Router, type Request, type Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { startggService } from '../services/startggService.js'
import { prisma } from '../lib/prisma.js'
import { io } from '../index.js'

const router: ExpressRouter = Router()

// GET /api/startgg/config — Lire la config
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await prisma.startggConfig.findUnique({ where: { id: 1 } })
    if (!config) {
      return res.json({
        apiKey: process.env.STARTGG ? '***configured***' : null,
        tournamentSlug: null,
        eventId: null,
        pollIntervalMs: 15000,
        enabled: false,
      })
    }
    return res.json({
      ...config,
      apiKey: config.apiKey ? '***configured***' : null,
    })
  } catch (error) {
    console.error('[startgg] config error:', error)
    return res.status(500).json({ error: 'Failed to get config' })
  }
})

// PUT /api/startgg/config — Sauvegarder la config
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { apiKey, tournamentSlug, eventId, pollIntervalMs, enabled } = req.body
    const config = await prisma.startggConfig.upsert({
      where: { id: 1 },
      update: {
        ...(apiKey !== undefined && { apiKey }),
        ...(tournamentSlug !== undefined && { tournamentSlug }),
        ...(eventId !== undefined && { eventId }),
        ...(pollIntervalMs !== undefined && { pollIntervalMs }),
        ...(enabled !== undefined && { enabled }),
      },
      create: {
        id: 1,
        apiKey: apiKey ?? process.env.STARTGG ?? '',
        tournamentSlug,
        eventId,
        pollIntervalMs: pollIntervalMs ?? 15000,
        enabled: enabled ?? false,
      },
    })
    return res.json({
      ...config,
      apiKey: config.apiKey ? '***configured***' : null,
    })
  } catch (error) {
    console.error('[startgg] config update error:', error)
    return res.status(500).json({ error: 'Failed to update config' })
  }
})

// GET /api/startgg/tournaments — Mes tournois
router.get('/tournaments', async (_req: Request, res: Response) => {
  try {
    const tournaments = await startggService.getMyTournaments()
    return res.json(tournaments)
  } catch (error) {
    console.error('[startgg] tournaments error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// GET /api/startgg/tournaments/:slug/events — Events d'un tournoi
router.get('/tournaments/:slug/events', async (req: Request, res: Response) => {
  try {
    // Le slug arrive potentiellement avec 'tournament/' déjà inclus (URL encoded)
    // On le passe tel quel au service qui gère la normalisation
    const slug = req.params.slug!
    const events = await startggService.getTournamentEvents(slug)
    return res.json(events)
  } catch (error) {
    console.error('[startgg] events error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// GET /api/startgg/events/:eventId/sets — Sets d'un event
router.get('/events/:eventId/sets', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.eventId!
    const { state, page, perPage } = req.query

    const options: { page?: number; perPage?: number; states?: number[] } = {}
    if (state) {
      options.states = String(state).split(',').map(Number)
    }
    if (page) {
      options.page = Number(page)
    }
    if (perPage) {
      options.perPage = Number(perPage)
    }

    const sets = await startggService.getEventSets(eventId, options)
    return res.json(sets)
  } catch (error) {
    console.error('[startgg] sets error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// GET /api/startgg/events/:eventId/active — Sets actifs d'un event
router.get('/events/:eventId/active', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.eventId!
    const sets = await startggService.getActiveSets(eventId)
    return res.json(sets)
  } catch (error) {
    console.error('[startgg] active sets error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// POST /api/startgg/sets/:setId/select — Sélectionner un set pour OBS
router.post('/sets/:setId/select', async (req: Request, res: Response) => {
  try {
    const setId = req.params.setId!
    const result = await startggService.selectSet(setId)

    // Convertir pour Socket.io (createdAt en string ISO)
    const matchForSocket = {
      ...result.match,
      createdAt: result.match.createdAt.toISOString(),
    }

    // Émettre l'event Socket.io pour mettre à jour OBS et les clients
    io.emit('currentMatchChanged', { match: matchForSocket })

    return res.json(result)
  } catch (error) {
    console.error('[startgg] select set error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// GET /api/startgg/sets/:setId — Détail d'un set
router.get('/sets/:setId', async (req: Request, res: Response) => {
  try {
    const setId = req.params.setId!
    const set = await startggService.getSetDetail(setId)
    return res.json(set)
  } catch (error) {
    console.error('[startgg] set detail error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// GET /api/startgg/local-sets — Sets stockés localement
router.get('/local-sets', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.query
    const sets = await startggService.getLocalSets(eventId ? String(eventId) : undefined)
    return res.json(sets)
  } catch (error) {
    console.error('[startgg] local sets error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// Polling state
let pollInterval: NodeJS.Timeout | null = null

// POST /api/startgg/poll/start — Démarrer le polling
router.post('/poll/start', async (_req: Request, res: Response) => {
  try {
    if (pollInterval) {
      return res.json({ status: 'already_running' })
    }

    const config = await prisma.startggConfig.findUnique({ where: { id: 1 } })
    if (!config?.eventId) {
      return res.status(400).json({ error: 'No eventId configured' })
    }

    const intervalMs = config.pollIntervalMs ?? 15000

    // Poll immédiatement puis à intervalle
    const doPoll = async () => {
      try {
        const result = await startggService.getActiveSets(config.eventId!)
        console.log(`[startgg] Polled ${result.sets.length} active sets`)
        // TODO: émettre via Socket.io si changement détecté
      } catch (err) {
        console.error('[startgg] Poll error:', err)
      }
    }

    await doPoll()
    pollInterval = setInterval(doPoll, intervalMs)

    await prisma.startggConfig.update({
      where: { id: 1 },
      data: { enabled: true },
    })

    return res.json({ status: 'started', intervalMs })
  } catch (error) {
    console.error('[startgg] poll start error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

// POST /api/startgg/poll/stop — Arrêter le polling
router.post('/poll/stop', async (_req: Request, res: Response) => {
  try {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }

    await prisma.startggConfig.update({
      where: { id: 1 },
      data: { enabled: false },
    })

    return res.json({ status: 'stopped' })
  } catch (error) {
    console.error('[startgg] poll stop error:', error)
    return res.status(500).json({ error: String(error) })
  }
})

export default router
