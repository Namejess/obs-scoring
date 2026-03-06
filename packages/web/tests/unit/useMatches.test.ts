import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })),
  },
}))

// Mock useSocket
vi.mock('../../src/composables/useSocket', () => ({
  useSocket: vi.fn(() => ({
    onScoreUpdate: vi.fn(),
    onMatchCreated: vi.fn(),
    onMatchDeleted: vi.fn(),
    onCurrentMatchChanged: vi.fn(),
  })),
}))

describe('useMatches', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should export match management functions', async () => {
    const { useMatches } = await import('../../src/composables/useMatches')
    const {
      matches,
      currentMatch,
      loading,
      error,
      fetchMatches,
      fetchCurrentMatch,
      createMatch,
      updateScore,
      setCurrentMatch,
      deleteMatch,
    } = useMatches()

    expect(matches.value).toEqual([])
    expect(currentMatch.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(fetchMatches).toBeInstanceOf(Function)
    expect(fetchCurrentMatch).toBeInstanceOf(Function)
    expect(createMatch).toBeInstanceOf(Function)
    expect(updateScore).toBeInstanceOf(Function)
    expect(setCurrentMatch).toBeInstanceOf(Function)
    expect(deleteMatch).toBeInstanceOf(Function)
  })
})
