import cors from 'cors'
import type { CorsOptions } from 'cors'

export function createCorsMiddleware(): ReturnType<typeof cors> {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [
    'http://localhost:5173',
  ]

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true)
        return
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS not allowed for origin: ${origin}`))
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }

  return cors(corsOptions)
}

export function getCorsOriginsForSocketIO(): string[] {
  return process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? ['http://localhost:5173']
}
