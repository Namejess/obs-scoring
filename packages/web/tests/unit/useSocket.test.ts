import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    io: {
      on: vi.fn(),
    },
  })),
}))

describe('useSocket', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should export socket utilities', async () => {
    const { useSocket } = await import('../../src/composables/useSocket')
    const { socket, status, isConnected, isReconnecting } = useSocket()

    expect(socket).toBeDefined()
    expect(status).toBeDefined()
    expect(isConnected).toBeInstanceOf(Function)
    expect(isReconnecting).toBeInstanceOf(Function)
  })

  it('should have initial status as disconnected', async () => {
    const { useSocket } = await import('../../src/composables/useSocket')
    const { status } = useSocket()

    // Initial state before connect event
    expect(['disconnected', 'connecting']).toContain(status.value)
  })
})
