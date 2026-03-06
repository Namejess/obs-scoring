// Load environment variables FIRST
import 'dotenv/config'

import express, { type Express } from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  ServerInfo,
} from '@obs-scoring/shared'

import { createCorsMiddleware, getCorsOriginsForSocketIO } from './middleware/cors.js'
import { createMatchRoutes } from './routes/matches.js'
import startggRouter from './routes/startgg.js'

const app: Express = express()
const httpServer = createServer(app)

// Socket.io with typed events
const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: getCorsOriginsForSocketIO(),
    methods: ['GET', 'POST', 'PATCH'],
  },
})

// Middleware
app.use(createCorsMiddleware())
app.use(express.json())

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OBS Scoring API',
      version: '1.0.0',
      description: 'Real-time match scoring API for OBS Studio overlays',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT ?? 3000}`,
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Matches', description: 'Match management endpoints' },
      { name: 'OBS', description: 'OBS-specific endpoints for overlay integration' },
    ],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Health check / server info endpoint
app.get('/health', (_req, res) => {
  const info: ServerInfo = {
    name: 'OBS Scoring Server',
    version: '1.0.0',
    status: 'ok',
  }
  res.json(info)
})

// Routes
app.use('/matches', createMatchRoutes(io))
app.use('/api/startgg', startggRouter)

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// Start server
const PORT = parseInt(process.env.PORT ?? '3000', 10)

httpServer.listen(PORT, () => {
  console.log(`
🚀 OBS Scoring Server running!
   
   REST API:    http://localhost:${PORT}
   Swagger UI:  http://localhost:${PORT}/api-docs
   WebSocket:   ws://localhost:${PORT}
   
   CORS origins: ${getCorsOriginsForSocketIO().join(', ')}
  `)
})

export { app, io, httpServer }
