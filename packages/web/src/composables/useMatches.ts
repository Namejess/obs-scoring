import { ref } from 'vue'
import axios from 'axios'
import type { Match, CreateMatchDto, UpdateScoreDto, OBSOverlayData } from '@obs-scoring/shared'
import { useSocket } from './useSocket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function useMatches() {
  const matches = ref<Match[]>([])
  const currentMatch = ref<Match | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const { onScoreUpdate, onMatchCreated, onMatchDeleted, onCurrentMatchChanged } = useSocket()

  // Listen to socket events
  onScoreUpdate((event) => {
    const match = matches.value.find((m) => m.id === event.matchId)
    if (match) {
      match.player1Score = event.player1Score
      match.player2Score = event.player2Score
    }
    if (currentMatch.value?.id === event.matchId) {
      currentMatch.value.player1Score = event.player1Score
      currentMatch.value.player2Score = event.player2Score
    }
  })

  onMatchCreated((event) => {
    matches.value.unshift(event.match)
  })

  onMatchDeleted((event) => {
    matches.value = matches.value.filter((m) => m.id !== event.id)
    if (currentMatch.value?.id === event.id) {
      currentMatch.value = null
    }
  })

  onCurrentMatchChanged((event) => {
    // Update isCurrent flag on all matches
    matches.value.forEach((m) => {
      m.isCurrent = m.id === event.match?.id
    })
    currentMatch.value = event.match

    // If match doesn't exist in list, add it (for start.gg selected matches)
    if (event.match && !matches.value.find((m) => m.id === event.match?.id)) {
      matches.value.unshift(event.match)
    }
  })

  async function fetchMatches() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get<Match[]>('/matches')
      matches.value = response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch matches'
    } finally {
      loading.value = false
    }
  }

  async function fetchCurrentMatch() {
    try {
      const response = await api.get<Match>('/matches/current')
      currentMatch.value = response.data
    } catch {
      currentMatch.value = null
    }
  }

  async function fetchMatch(id: number): Promise<Match | null> {
    try {
      const response = await api.get<Match>(`/matches/${id}`)
      return response.data
    } catch {
      return null
    }
  }

  async function createMatch(data: CreateMatchDto): Promise<Match | null> {
    error.value = null
    try {
      const response = await api.post<Match>('/matches', data)
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create match'
      return null
    }
  }

  async function updateScore(id: number, data: UpdateScoreDto): Promise<Match | null> {
    error.value = null
    try {
      const response = await api.patch<Match>(`/matches/${id}`, data)
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update score'
      return null
    }
  }

  async function setCurrentMatch(id: number): Promise<Match | null> {
    error.value = null
    try {
      const response = await api.patch<Match>(`/matches/${id}/setCurrent`)
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to set current match'
      return null
    }
  }

  async function deleteMatch(id: number): Promise<boolean> {
    error.value = null
    try {
      await api.delete(`/matches/${id}`)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete match'
      return false
    }
  }

  async function fetchOBSData(): Promise<OBSOverlayData | null> {
    try {
      const response = await api.get<OBSOverlayData>('/matches/obsData')
      return response.data
    } catch {
      return null
    }
  }

  return {
    // State
    matches,
    currentMatch,
    loading,
    error,

    // Actions
    fetchMatches,
    fetchCurrentMatch,
    fetchMatch,
    createMatch,
    updateScore,
    setCurrentMatch,
    deleteMatch,
    fetchOBSData,
  }
}
