import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    query: {},
  })),
}))

// Mock useSocket
vi.mock('../../src/composables/useSocket', () => ({
  useSocket: vi.fn(() => ({
    status: { value: 'connected' },
    onScoreUpdate: vi.fn(),
    onCurrentMatchChanged: vi.fn(),
  })),
}))

// Mock useMatches
vi.mock('../../src/composables/useMatches', () => ({
  useMatches: vi.fn(() => ({
    fetchOBSData: vi.fn(() =>
      Promise.resolve({
        players: [
          { name: 'Alice', team: 'Red', score: 3 },
          { name: 'Bob', team: 'Blue', score: 2 },
        ],
        matchId: 1,
      })
    ),
  })),
}))

describe('ScoreOverlay', () => {
  it('should render with default config', async () => {
    const ScoreOverlay = (await import('../../src/components/obs/ScoreOverlay.vue')).default

    const wrapper = mount(ScoreOverlay)

    // Wait for async data load
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(wrapper.find('.overlay').exists()).toBe(true)
  })
})
